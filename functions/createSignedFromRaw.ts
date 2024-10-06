import { Functioneer, FunctionRunResult } from "functioneer";
import { arrayBufferToBase64, QubicInterface } from "../lib/qubicInterface";

export function addFunction(func: Functioneer) {
  func
    .registerFunction(
      "createSignedFromRaw",
      "Signs raw data",
      async (seed: string, rawBase64: string) => {
        const qubicInterface = new QubicInterface();

        const res = await qubicInterface.getSignedFromRaw(rawBase64, seed);
        return JSON.stringify(res);
      }
    )
    .addField("seed", "string", "Seed to sign with")
    .addField(
      "rawData",
      "string",
      "The raw data to be signed (encoded in base64)"
    );
}
