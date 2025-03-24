import { Functioneer, FunctionRunResult } from "functioneer";
import { arrayBufferToBase64, QubicInterface } from "../lib/qubicInterface";

export function addFunction(func: Functioneer) {
    func
        .registerFunction(
            "parseAssetTransferPayload",
            "Parses an asset input",
            async (input: string) => {
                const qubicInterface = new QubicInterface();
                try {
                    const binaryData = new Uint8Array(
                        input.match(/.{1,2}/g)?.map((pair) => parseInt(pair, 16)) ?? []
                    );

                    const res = await qubicInterface.parseAssetTransferPayload(binaryData);

                    // Custom replacer function to handle BigInt serialization
                    return JSON.stringify(res, (key, value) => {
                        // Convert BigInt to string when serializing
                        if (typeof value === 'bigint') {
                            return value.toString();
                        }
                        return value;
                    });

                } catch (error) {
                    throw new Error(`Failed to parse asset input: ${error.message}`);
                }
            }
        )
        .addField("input", "string", "Hexadecimal asset input string to parse");
}