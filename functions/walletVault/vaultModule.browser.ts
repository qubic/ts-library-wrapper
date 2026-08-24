/**
 * Loads `@qubic.org/vault` — bundler variant, mapped from `vaultModule.ts` by the `browser`
 * field in package.json. The import must stay **static** so Parcel inlines the library into
 * the single self-contained HTML that Flutter ships; a dynamic one emits a separate async
 * chunk the webview never loads.
 *
 * See *The ESM/CommonJS problem* in migration-test/README.md before changing this.
 */
import * as vaultModule from "@qubic.org/vault";

export function loadVaultModule(): Promise<any> {
  return Promise.resolve(vaultModule);
}
