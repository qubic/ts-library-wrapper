import {Functioneer, FunctionRunResult} from "functioneer";
import * as shared from "./shared/shared";
import {WalletService} from "./shared/walletService";
import {IDecodedSeed, ISeed} from "./model/seed";
import {arrayBufferToBase64} from "../../lib/qubicInterface";
import {
    createVaultV3,
    ExportableSeed,
    parseSeeds,
    tryVaultManagerForWriting,
} from "../walletVault/vaultService";

async function exportV1(password: string, inputSeeds: ExportableSeed[]): Promise<string> {
    const seeds: IDecodedSeed[] = inputSeeds.map((seed) => ({
        alias: seed.alias,
        seed: seed.seed,
        publicId: seed.publicId,
        balance: 0,
        balanceTick: 0,
        encryptedSeed: "",
        isOnlyWatch: seed.isOnlyWatch === true,
    }));

    const wService = new WalletService();
    await wService.createNewKeys();
    wService.runningConfiguration.name = "exported";
    for (const seed of seeds) {
        await wService.addSeed(seed);
    }
    return await wService.exportVault(password);
}

async function exportV3(password: string, seeds: ExportableSeed[]): Promise<string> {
    const vault = await createVaultV3(password, seeds);
    return arrayBufferToBase64(
        vault.buffer.slice(vault.byteOffset, vault.byteOffset + vault.byteLength) as ArrayBuffer
    );
}

export function addFunction(func: Functioneer) {
    func
        .registerFunction(
            "wallet.createVaultFile",
            "Creates a vault file from wallet contents",
            async (password: string, seedsJSON: string) => {
                const seeds = parseSeeds(seedsJSON);
                // v3 wherever it can be written (the browser/HTML asset the wallets ship), v1 in
                // the pkg-built desktop CLIs, which lack Web Crypto. See tryVaultManagerForWriting.
                const manager = await tryVaultManagerForWriting();
                const base64 = manager
                    ? await exportV3(password, seeds)
                    : await exportV1(password, seeds);
                return JSON.stringify({base64});
            }
        )
        .addField("password", "string", "Password to encrypt the vault file with")
        .addField(
            "seedsJSON",
            "string",
            "JSON string of seeds to export [{alias: string, seed: string, publicId: string}]"
        );
}
