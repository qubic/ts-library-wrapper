import { WalletImporter } from "../walletImporter/walletImporter";
import { loadVaultModule } from "./vaultModule";

/**
 * Returns a `VaultManager`, or `null` when `@qubic.org/vault` cannot be loaded at all.
 *
 * That happens inside the `pkg`-built CLIs: their V8 snapshot cannot evaluate a dynamic
 * `import()` and throws `TypeError: Invalid host defined options`. Callers degrade to the
 * wrapper's own legacy importer rather than failing, which keeps the packaged CLIs able to
 * read v1 vaults exactly as they did before this change.
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
 * Reads the format version straight off the bytes, without `@qubic.org/vault`.
 *
 * A legacy vault is a JSON document, so it starts with `{`. Every later format is a binary
 * envelope whose first byte *is* the version. Used when the library is unavailable (the
 * packaged CLIs) and to pick the right path before the library is even consulted.
 */
function detectVaultVersion(bytes: Uint8Array): number {
  if (bytes.length === 0) {
    throw new Error("INVALID VAULT FILE");
  }
  return bytes[0] === 0x7b /* '{' */ ? VAULT_VERSION_LEGACY : bytes[0];
}

/**
 * Detects the vault format without decrypting.
 * Returns 1 (legacy JSON `{salt,iv,cipher}`) or 3 (binary Argon2id envelope).
 */
export async function getVaultVersion(
  data: ArrayBuffer | Uint8Array
): Promise<number> {
  const bytes = toUint8Array(data);
  const manager = await tryNewVaultManager();
  return manager ? manager.getVersion(bytes) : detectVaultVersion(bytes);
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

/**
 * True when a payload returned by `@qubic.org/vault` is missing seed material that the
 * vault is supposed to contain (i.e. a non-watch-only account came back without a seed).
 *
 * `@qubic.org/vault@1.2.0` returns v1 accounts *without* decrypting `encryptedSeed`, so
 * this guard is what keeps us from silently importing seed-less (unusable) accounts.
 */
function isMissingSeedMaterial(seeds: RecoveredSeed[]): boolean {
  return seeds.some((s) => !s.isOnlyWatch && s.seed.length === 0);
}

function mapPayloadSeeds(payloadSeeds: any[]): RecoveredSeed[] {
  return (payloadSeeds ?? []).map((entry) => {
    const isOnlyWatch = entry.isOnlyWatch === true;
    const raw = entry.encryptedSeed;
    return {
      alias: entry.alias ?? "",
      publicId: entry.publicId,
      seed: raw && raw.length > 0 ? textDecoder.decode(raw) : "",
      isOnlyWatch,
    };
  });
}

/**
 * Unlocks a vault file of ANY supported version and returns its seeds.
 *
 * - v3 vaults are read with `@qubic.org/vault`.
 * - v1 vaults are read with `@qubic.org/vault` when it can fully recover the seeds, and
 *   otherwise fall back to the wrapper's own importer.
 *
 * The fallback exists because legacy support in `@qubic.org/vault` is still landing
 * (see qubic/qubic-typescript#27): 1.2.0 drops v1 seeds entirely, and the pending fix
 * throws on vaults that contain a watch-only account. Falling back keeps legacy imports
 * byte-for-byte identical to today's behaviour regardless of which version is installed.
 * Once legacy support is released and verified, the fallback can be removed.
 *
 * It also covers the packaged CLIs, where the library cannot be loaded at all: v1 keeps
 * working through the wrapper's own importer, and v3 reports a clear error instead of an
 * opaque one. See `tryNewVaultManager`.
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
    } catch (e) {
      // fall through to the legacy importer
    }
    return unlockLegacyWithFallback(bytes, password);
  }

  const payload = await manager.unlock(bytes, password);
  return mapPayloadSeeds(payload.seeds as any[]);
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
