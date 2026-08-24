import { Functioneer } from "functioneer";
import { unlockVault } from "../walletVault/vaultService";
import { IDecodedSeed } from "./model/seed";
import { WalletImporter } from "./walletImporter";

export function addFunction(func: Functioneer) {
  func
    .registerFunction(
      "wallet.importVault",
      "Reads the seeds of a vault file as base64. Supports legacy (v1) and current (v3) vault files.",
      async (password: string, base64VaultFile: string) => {
        const walletImporter = new WalletImporter();
        const ab = await walletImporter.base64ToArrayBuffer(base64VaultFile);
        const recovered = await unlockVault(ab, password);

        const seeds: IDecodedSeed[] = recovered.map((seed) => ({
          alias: seed.alias,
          seed: seed.seed,
          publicId: seed.publicId,
          balance: 0,
          balanceTick: 0,
          encryptedSeed: "",
          isOnlyWatch: seed.isOnlyWatch,
        }));

        return JSON.stringify({
          seeds: seeds,
        });
      }
    )
    .addField("password", "string", "Password to decrypt the vault file with")
    .addField("base64VaultFile", "string", "Base64 encoded vault file");

  func
    .registerFunction(
      "wallet.importVaultFile",
      "Reads the seeds of a vault file. Supports legacy (v1) and current (v3) vault files.",
      async (password: string, filename: string) => {
        const { readFileSync } = require("fs");
        const contents = readFileSync(filename, null);

        const recovered = await unlockVault(contents, password);

        const seeds = recovered.map((seed) => ({
          alias: seed.alias,
          seed: seed.seed,
          publicId: seed.publicId,
          isOnlyWatch: seed.isOnlyWatch,
        }));

        return JSON.stringify({
          seeds: seeds,
        });
      }
    )
    .addField("password", "string", "Password to decrypt the vault file with")
    .addField("filename", "string", "Path to the vault file");
}
