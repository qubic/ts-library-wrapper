import { Functioneer } from "functioneer";
import { publicKeyStringToBytes } from "../converter/converter.js";

export function addFunction(func: Functioneer) {
  func
    .registerFunction(
      "publicKeyStringToBytes",
      "Convert a public key string to bytes",
      async (publicKeyString: string) => {
        try {
          const bytes = publicKeyStringToBytes(publicKeyString);
          return JSON.stringify({
            bytes: Array.from(bytes),
          });
        } catch (e: any) {
          return JSON.stringify({
            status: "error",
            error: e.message || "Failed to convert public key string to bytes",
          });
        }
      }
    )
    .addField("publicKeyString", "string", "The public key string to convert");
}
