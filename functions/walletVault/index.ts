import { Functioneer } from "functioneer";
import { arrayBufferToBase64 } from "../../lib/qubicInterface";
import { createVaultV3, getVaultVersion, parseSeeds } from "./vaultService";

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
      "Creates a v3 (Argon2id) vault file from wallet contents. Always v3, unlike wallet.createVaultFile which falls back to v1 in the desktop CLIs.",
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
