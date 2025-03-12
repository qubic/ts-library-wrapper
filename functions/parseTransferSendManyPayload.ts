import { Functioneer } from "functioneer";
import { QubicInterface } from "../lib/qubicInterface";

export function addFunction(func: Functioneer) {

    func
        .registerFunction(
            "parseTransferSendManyPayload",
            "Parses a transfer input",
            async (input: string) => {
                const qubicInterface = new QubicInterface();
                try {
                    const binaryData = new Uint8Array(
                        input.match(/.{1,2}/g)?.map((pair) => parseInt(pair, 16)) ?? []
                    );

                    const res = await qubicInterface.parseTransferSendManyPayload(binaryData);

                    return JSON.stringify(res, (key, value) =>
                        typeof value === "bigint" ? value.toString() : value
                    );
                } catch (error) {
                    throw new Error(`Failed to parse transfer input: ${error.message}`);
                }
            }
        )
        .addField("input", "string", "Hexadecimal transfer input string to parse");
}
