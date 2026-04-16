import { Functioneer } from "functioneer";
import { base64ToUint8 } from "../lib/qubicInterface";
import { publicKeyStringToBytes } from "../converter/converter.js";
import crypto from "../crypto/index.js";

/**
 * Verifies a UTF-8 message signature produced by `signMessage`
 * (raw message bytes, no prefix, no pre-hashing).
 *
 * Compatible with the web wallet and the Qubic Toolkit.
 *
 * Distinct from any verification of `createSigned.fromUTF8` output, which
 * would need to account for the "Qubic Signed Message:\n" prefix and the
 * K12 digest step used by QubicPackageBuilder.
 */
export function addFunction(func: Functioneer) {
  func
    .registerFunction(
      "verifyMessage",
      "Verifies a UTF-8 message signature against a public identity (no prefix, no pre-hashing).",
      async (identity: string, UTF8Text: string, signatureB64: string) => {
        const cryptoModule = await crypto;

        const publicKeyBytes = publicKeyStringToBytes(identity);
        const messageBytes = new TextEncoder().encode(UTF8Text);
        const signatureBytes = base64ToUint8(signatureB64);

        const result = cryptoModule.schnorrq.verify(
          publicKeyBytes,
          messageBytes,
          signatureBytes
        );

        return JSON.stringify({ isValid: result === 1 });
      }
    )
    .addField("identity", "string", "The 60-character Qubic public identity")
    .addField("UTF8Text", "string", "The UTF-8 text message that was signed")
    .addField(
      "signatureB64",
      "string",
      "The signature in base64 encoding (64 bytes)"
    );
}
