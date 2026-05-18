import { Functioneer } from "functioneer";
import { QubicInterface } from "../lib/qubicInterface";

/**
 * Computes a 1-byte K12 checksum of the input bytes.
 *
 * Used by the sign-message feature to append a checksum byte to the
 * raw 64-byte Schnorrq signature, producing the 65-byte format
 * (130-char shifted-hex) that is standard across Qubic wallets and tools.
 */
export function addFunction(func: Functioneer) {
  func
    .registerFunction(
      "computeK12Checksum",
      "Computes a 1-byte K12 hash checksum of the input bytes",
      async (dataB64: string) => {
        const qubicInterface = new QubicInterface();
        const res = await qubicInterface.computeK12Checksum(dataB64);
        return JSON.stringify(res);
      }
    )
    .addField(
      "dataB64",
      "string",
      "The data to checksum, in base64 encoding"
    );
}
