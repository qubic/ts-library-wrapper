/**
 * Loads `@qubic.org/vault` — bundler variant (Parcel / the webview build).
 *
 * A static import is what we want here: Parcel inlines the module into the single
 * self-contained HTML that Flutter ships as an asset. A dynamic import would instead emit a
 * separate async chunk, which the webview never loads.
 *
 * package.json maps `vaultModule.ts` to this file for browser targets. Node keeps the
 * lazy variant so the CommonJS CLI build can still start — see `vaultModule.ts`.
 */
import * as vaultModule from "@qubic.org/vault";

export function loadVaultModule(): Promise<any> {
  return Promise.resolve(vaultModule);
}
