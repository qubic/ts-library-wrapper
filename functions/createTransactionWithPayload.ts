import { Functioneer, FunctionRunResult } from "functioneer";
import { arrayBufferToBase64, QubicInterface } from "../lib/qubicInterface";

export function addFunction(func: Functioneer) {
    func
        .registerFunction(
            "createTransactionWithPayload",
            "Creates a transaction with a payload",
            async (
                sourceSeed: string,
                destPublicId: string,
                amount: number,
                tick: number,
                inputType: number,
                payload: string,
            ) => {
                const qubicInterface = new QubicInterface();

                // Decode the base64 payload with validation
                let decodedPayload = null;

                // Trim the payload to check for empty or whitespace-only strings
                if (!payload || payload.trim().length === 0) {
                    decodedPayload = new Uint8Array(0);  // Empty array instead of null
                } else {
                    try {
                        decodedPayload = Uint8Array.from(Buffer.from(payload, "base64"));
                    } catch (err) {
                        throw new Error("Invalid base64 payload");
                    }
                }

                // Perform the transaction
                try {
                    const res = await qubicInterface.getTransactionWithPayload(
                        sourceSeed,
                        destPublicId,
                        amount,
                        tick,
                        inputType,
                        decodedPayload,
                        true
                    );
                    return JSON.stringify(res);
                } catch (error) {
                    throw new Error(`Failed to create transaction: ${error.message}`);
                }
            }
        )
        .addField("seed", "string", "Seed of the source account")
        .addField("destPublicId", "string", "Public ID of the destination account")
        .addField("amount", "number", "Amount to transfer")
        .addField("tick", "number", "Tick of the transaction")
        .addField("inputType", "number", "Input type for the transaction")
        .addField("payload", "string", "Base64 encoded payload");
}
