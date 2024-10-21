import { Functioneer, FunctionRunResult } from "functioneer";
import { arrayBufferToBase64, QubicInterface } from "../lib/qubicInterface";

export function addFunction(func: Functioneer) {
  func
    .registerFunction(
      "createSigned.fromRaw",
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

  func
    .registerFunction(
      "createSigned.fromASCII",
      "Signs ASCII text data",
      async (seed: string, ASCIIText: string) => {
        const qubicInterface = new QubicInterface();
        console.log("IN!");

        const res = await qubicInterface.getSignedFromASCIIString(
          ASCIIText,
          seed
        );
        return JSON.stringify(res);
      }
    )
    .addField("seed", "string", "Seed to sign with")
    .addField("ASCIIText", "string", "The ASCII text data to be signed");

  func
    .registerFunction(
      "createSigned.fromUTF8",
      "Signs UTF8 text data",
      async (seed: string, UTF8Text: string) => {
        const qubicInterface = new QubicInterface();

        const res = await qubicInterface.getSignedFromUTFString(UTF8Text, seed);
        return JSON.stringify(res);
      }
    )
    .addField("seed", "string", "Seed to sign with")
    .addField("UTF8Text", "string", "The UTF-8 text data to be signed");
}
