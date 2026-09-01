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
 * Reads seeds from a v1 vault using the wrapper's own (long-proven) importer.
 *
 * This is the compatibility path: it correctly RSA-decrypts seeds and returns an empty
 * seed for watch-only accounts. It is used whenever `@qubic.org/vault` cannot fully
 * recover a legacy vault (see `unlockVault`).
 */
async function unlockLegacyWithFallback(
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

/** Same shape the export path enforces. */
const SEED_PATTERN = /^[a-z]{55}$/;

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
 * Unlocks a vault file of any supported version and returns its seeds.
 *
 * v1 falls back to the wrapper's own importer whenever the library cannot fully recover the
 * vault, which keeps legacy imports correct on every version of it: 1.2.0 drops v1 seeds
 * entirely and the fix in qubic/qubic-typescript#27 threw on watch-only accounts. The
 * fallback can go once every wallet is on 1.2.1+.
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
    return unlockLegacyWithFallback(bytes, password);
  }

  if (version === VAULT_VERSION_LEGACY) {
    try {
      const payload = await manager.unlock(bytes, password);
      const seeds = mapPayloadSeeds(payload.seeds as any[]);
      if (!isMissingSeedMaterial(seeds)) {
        return seeds;
      }
    } catch (e) {}
    return unlockLegacyWithFallback(bytes, password);
  }

  const payload = await manager.unlock(bytes, password);
  const seeds = mapPayloadSeeds(payload.seeds as any[]);
  // Nothing can read v3 but the library, so there is no fallback here — refuse the file.
  if (isMissingSeedMaterial(seeds)) {
    return Promise.reject("INVALID VAULT FILE");
  }
  return seeds;
}

/**
 * Writes a v3 (Argon2id) vault file containing the given seeds.
 *
 * NOTE ON ROLLOUT: a v3 vault cannot be read by any wallet that has not yet shipped a v3
 * reader. Keep exporting v1 (`wallet.createVaultFile`) until the web wallet, the browser
 * extension and the mobile wallet can all *read* v3.
 */
export async function createVaultV3(
  password: string,
  seeds: ExportableSeed[]
): Promise<Uint8Array> {
  const now = new Date().toISOString();
  const manager = await tryNewVaultManager();
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
