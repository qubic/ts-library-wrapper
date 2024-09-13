import { Functioneer } from "functioneer";
import { QubicInterface } from "../lib/qubicInterface";

export function addFunction(func: Functioneer) {
    func
        .registerFunction(
            "verifyIdentity",
            "Verifies if the provided public ID is valid",
            async (publicId: string) => {
                const qubicInterface = new QubicInterface();
                const isValid = await qubicInterface.verifyIdentity(publicId);
                return JSON.stringify({ isValid });
            }
        )
        .addField("publicId", "string", "The public ID to verify");
}
