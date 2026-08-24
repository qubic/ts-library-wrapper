import { Functioneer } from "functioneer";
import { arrayBufferToBase64 } from "../../lib/qubicInterface";
import {
  createVaultV3,
  ExportableSeed,
  getVaultVersion,
} from "./vaultService";

interface exportedSeedInfo {
  isOnlyWatch: boolean;
  alias: string;
  seed: string;
  publicId: string;
}

function parseSeeds(seedsJSON: string): ExportableSeed[] {
  let inputSeeds: exportedSeedInfo[] = [];
  try {
    inputSeeds = JSON.parse(seedsJSON) as exportedSeedInfo[];
  } catch (e) {
    throw "Could not parse seeds JSON";
  }

  return inputSeeds.map((seed) => {
    if (
      seed.seed === null ||
      seed.seed === undefined ||
      (!/^([a-z]){55}$/g.test(seed.seed) && seed.seed !== "")
    ) {
      throw new Error(
        "Seed must be 55 characters long and only contain lowercase letters, or be an empty string"
      );
    }
    if (!seed.publicId || !/^([A-Z]){60}$/g.test(seed.publicId)) {
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

export function addFunctions(func: Functioneer) {
  func
    .registerFunction(
      "wallet.getVaultVersion",
      "Returns the format version of a vault file (1 = legacy, 3 = current) without decrypting it",
      async (base64VaultFile: string) => {
        const binary = Uint8Array.from(atob(base64VaultFile), (c) =>
          c.charCodeAt(0)
        );
        return JSON.stringify({ version: await getVaultVersion(binary) });
      }
    )
    .addField("base64VaultFile", "string", "Base64 encoded vault file");

  func
    .registerFunction(
      "wallet.createVaultFileV3",
      "Creates a v3 (Argon2id) vault file from wallet contents. NOTE: only export v3 once every wallet can read it.",
      async (password: string, seedsJSON: string) => {
        const seeds = parseSeeds(seedsJSON);
        const vault = await createVaultV3(password, seeds);
        return JSON.stringify({
          base64: arrayBufferToBase64(
            vault.buffer.slice(
              vault.byteOffset,
              vault.byteOffset + vault.byteLength
            ) as ArrayBuffer
          ),
        });
      }
    )
    .addField("password", "string", "Password to encrypt the vault file with")
    .addField(
      "seedsJSON",
      "string",
      "JSON string of seeds to export [{alias: string, seed: string, publicId: string, isOnlyWatch: boolean}]"
    );
}
