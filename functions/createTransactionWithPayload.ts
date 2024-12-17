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

                // Decode the base64 payload if it's passed as a string
                const decodedPayload = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));

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
            }
        )
        .addField("seed", "string", "Seed of the source account")
        .addField("destPublicId", "string", "Public ID of the destination account")
        .addField("amount", "number", "Amount to transfer")
        .addField("tick", "number", "Tick of the transaction")
        .addField("inputType", "number", "Input type for the transaction")
        .addField("payload", "string", "Base64 encoded payload")
}
