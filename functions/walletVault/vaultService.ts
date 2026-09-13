import { WalletImporter } from "../walletImporter/walletImporter";
import { loadVaultModule } from "./vaultModule";

/**
 * Returns a `VaultManager`, or `null` inside the `pkg`-built CLIs, whose V8 snapshot cannot
 * evaluate a dynamic `import()`. Callers degrade to the legacy importer instead of failing,
 * so those binaries keep reading v1 vaults exactly as before.
 */
async function tryNewVaultManager(): Promise<any | null> {
  try {
    const mod = await loadVaultModule();
    return new mod.VaultManager();
  } catch (e) {
    return null;
  }
}

/**
 * A `VaultManager` when a v3 vault can actually be written here, or `null` when callers must
 * fall back to v1. The check is Web Crypto, not whether the library loaded: the pkg-built
 * desktop CLIs run on Node 16, which has no `globalThis.crypto`, so `VaultManager.create`
 * would throw on `getRandomValues` at write time. The browser/HTML asset always has it.
 */
export async function tryVaultManagerForWriting(): Promise<any | null> {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    return null;
  }
  return tryNewVaultManager();
}

/**
 * A seed recovered from a vault file.
 * `seed` is an empty string for watch-only accounts (matches the legacy bridge contract
 * and `QubicImportVaultSeed` on the Flutter side, which tolerates an empty seed).
 */
export interface RecoveredSeed {
  alias: string;
  publicId: string;
  seed: string;
  isOnlyWatch: boolean;
}

/** Seed input used when writing a vault. */
export interface ExportableSeed {
  alias: string;
  publicId: string;
  seed: string;
  isOnlyWatch?: boolean;
}

export const VAULT_VERSION_LEGACY = 1;
export const VAULT_VERSION_CURRENT = 3;

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/**
 * Version detection for when the library is unavailable (the `pkg` CLIs). Deliberately not a
 * first-byte check: parsing the JSON means a v1 file carrying a BOM or leading whitespace
 * still resolves, and anything unrecognised is rejected rather than reported as some
 * arbitrary version number.
 */
function detectVaultVersion(bytes: Uint8Array): number {
  if (bytes[0] === VAULT_VERSION_CURRENT && bytes.length >= 61) {
    return VAULT_VERSION_CURRENT;
  }
  try {
    const parsed = JSON.parse(textDecoder.decode(bytes));
    if (parsed && parsed.salt && parsed.iv && parsed.cipher) {
      return VAULT_VERSION_LEGACY;
    }
  } catch (e) {}
  throw new Error("INVALID VAULT FILE");
}

/** Returns 1 (legacy JSON `{salt,iv,cipher}`) or 3 (binary Argon2id envelope). */
export async function getVaultVersion(
  data: ArrayBuffer | Uint8Array
): Promise<number> {
  const bytes = toUint8Array(data);
  const manager = await tryNewVaultManager();
  try {
    return manager ? manager.getVersion(bytes) : detectVaultVersion(bytes);
  } catch (e) {
    // Same contract as unlockVault: every bridge error in this repo is a stable
    // wallet-authored string, never a third-party error class name.
    return Promise.reject("INVALID VAULT FILE");
  }
}

/**
 * Reads a v1 vault with the wrapper's own importer. Only used where `@qubic.org/vault` does
 * not load, which is the pkg-built desktop CLIs; everywhere else the library reads v1 too.
 */
async function unlockLegacyWithoutLibrary(
  data: Uint8Array,
  password: string
): Promise<RecoveredSeed[]> {
  const importer = new WalletImporter();
  const ok = await importer.importVault(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    password
  );
  if (!ok) {
    return Promise.reject("Import Failed (password or file do not match)");
  }

  const seeds: RecoveredSeed[] = [];
  for (const entry of importer.getSeeds()) {
    const isOnlyWatch = entry.isOnlyWatch === true;
    seeds.push({
      alias: entry.alias,
      publicId: entry.publicId,
      seed: isOnlyWatch ? "" : await importer.revealSeed(entry.publicId),
      isOnlyWatch,
    });
  }
  return seeds;
}

/** A valid Qubic seed: 55 lowercase letters. */
const SEED_PATTERN = /^[a-z]{55}$/;

interface SeedsJSONEntry {
  alias: string;
  publicId: string;
  seed: string;
  isOnlyWatch?: boolean;
}

/**
 * Parses the seeds JSON the bridge receives into validated seeds. The error strings are a
 * contract: Flutter matches "Could not parse seeds JSON" exactly to pick a localized message
 * (see wallet-app lib/resources/qubic_js.dart), so they must stay stable.
 */
export function parseSeeds(seedsJSON: string): ExportableSeed[] {
  let inputSeeds: SeedsJSONEntry[];
  try {
    inputSeeds = JSON.parse(seedsJSON) as SeedsJSONEntry[];
  } catch (e) {
    throw "Could not parse seeds JSON";
  }
  // Valid JSON that is not an array would otherwise reach .map and surface a raw TypeError.
  if (!Array.isArray(inputSeeds)) {
    throw "Could not parse seeds JSON";
  }
  return inputSeeds.map((seed) => {
    if (
      seed.seed === null ||
      seed.seed === undefined ||
      (!SEED_PATTERN.test(seed.seed) && seed.seed !== "")
    ) {
      throw new Error(
        "Seed must be 55 characters long and only contain lowercase letters, or be an empty string"
      );
    }
    if (!seed.publicId || !/^[A-Z]{60}$/.test(seed.publicId)) {
      throw new Error(
        "Public ID must be 60 characters long and contain only uppercase letters"
      );
    }
    return {
      alias: seed.alias,
      seed: seed.seed,
      publicId: seed.publicId,
      isOnlyWatch: seed.isOnlyWatch,
    };
  });
}

/**
 * True when the library returned a vault without the seed material it should contain.
 *
 * Do not remove: `@qubic.org/vault@1.2.0` returned v1 accounts *without* decrypting
 * `encryptedSeed`, and this guard is what stops that being imported as a set of unusable
 * accounts. An empty list counts as missing for the same reason.
 */
function isMissingSeedMaterial(seeds: RecoveredSeed[]): boolean {
  return (
    seeds.length === 0 || seeds.some((s) => !s.isOnlyWatch && s.seed.length === 0)
  );
}

function mapPayloadSeeds(payloadSeeds: any[]): RecoveredSeed[] {
  return (payloadSeeds ?? []).map((entry) => {
    const isOnlyWatch = entry.isOnlyWatch === true;
    const raw = entry.encryptedSeed;
    // The watch-only flag is authoritative, as on the legacy path. Shape-check the result
    // too: TextDecoder turns invalid bytes into U+FFFD rather than throwing, so without this
    // garbage would reach the wallet as a spendable account.
    const decoded =
      !isOnlyWatch && raw && raw.length > 0 ? textDecoder.decode(raw) : "";
    return {
      alias: entry.alias ?? "",
      publicId: entry.publicId,
      seed: SEED_PATTERN.test(decoded) ? decoded : "",
      isOnlyWatch,
    };
  });
}

/**
 * Unlocks a vault file of any supported version and returns its seeds. `@qubic.org/vault`
 * reads both v1 and v3; where it does not load (the pkg-built CLIs) v1 is read by the
 * wrapper's own importer and v3 is refused.
 */
export async function unlockVault(
  data: ArrayBuffer | Uint8Array,
  password: string
): Promise<RecoveredSeed[]> {
  const bytes = toUint8Array(data);
  const manager = await tryNewVaultManager();

  let version: number;
  try {
    version = manager ? manager.getVersion(bytes) : detectVaultVersion(bytes);
  } catch (e) {
    return Promise.reject("INVALID VAULT FILE");
  }

  if (!manager) {
    if (version !== VAULT_VERSION_LEGACY) {
      return Promise.reject(
        `Vault format v${version} is not supported by this build`
      );
    }
    return unlockLegacyWithoutLibrary(bytes, password);
  }

  let payload: any;
  try {
    payload = await manager.unlock(bytes, password);
  } catch (e) {
    // Stable wallet-authored string, never the library's error class (see README).
    return Promise.reject("Import Failed (password or file do not match)");
  }
  const seeds = mapPayloadSeeds(payload?.seeds as any[]);
  // A vault the library returns without its seed material is refused, not imported as a set
  // of unusable accounts.
  if (isMissingSeedMaterial(seeds)) {
    return Promise.reject("INVALID VAULT FILE");
  }
  return seeds;
}

/**
 * Writes a v3 (Argon2id) vault file containing the given seeds. `wallet.createVaultFile`
 * routes here whenever v3 can be written (see `tryVaultManagerForWriting`) and falls back
 * to the legacy v1 writer otherwise.
 */
export async function createVaultV3(
  password: string,
  seeds: ExportableSeed[]
): Promise<Uint8Array> {
  const now = new Date().toISOString();
  const manager = await tryVaultManagerForWriting();
  if (!manager) {
    return Promise.reject("Writing v3 vaults is not supported by this build");
  }

  return manager.create(
    {
      seeds: seeds.map((seed) => ({
        publicId: seed.publicId,
        alias: seed.alias,
        taintStatus: 0,
        isOnlyWatch: seed.isOnlyWatch === true,
        ...(seed.isOnlyWatch === true
          ? {}
          : { encryptedSeed: textEncoder.encode(seed.seed) }),
      })) as any,
      metadata: {
        createdAt: now,
        updatedAt: now,
        appVersion: "1.0.0",
        schemaVersion: 3,
      },
    } as any,
    password
  );
}
