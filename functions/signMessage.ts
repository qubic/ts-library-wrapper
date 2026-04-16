import { Functioneer } from "functioneer";
import { QubicInterface } from "../lib/qubicInterface";

/**
 * User-facing message signing function (no prefix, no extra hashing).
 *
 * Distinct from `createSigned.fromUTF8` / `createSigned.fromRaw` which:
 *   - prepend "Qubic Signed Message:\n" to defend against malicious dApps
 *     tricking users into signing raw transactions via WalletConnect
 *   - K12-hash the message before signing (via QubicPackageBuilder)
 *
 * `signMessage` signs the raw message bytes directly, producing signatures
 * compatible with the web wallet and the Qubic Toolkit.
 */
export function addFunction(func: Functioneer) {
  func
    .registerFunction(
      "signMessage",
      "Signs a UTF-8 message with a seed (no prefix, no pre-hashing). Use for user-facing message signing.",
      async (seed: string, UTF8Text: string) => {
        const qubicInterface = new QubicInterface();
        const res = await qubicInterface.signMessage(UTF8Text, seed);
        return JSON.stringify(res);
      }
    )
    .addField("seed", "string", "Seed to sign with")
    .addField(
      "UTF8Text",
      "string",
      "The UTF-8 text message to be signed (signed as-is, no prefix)"
    );
}
