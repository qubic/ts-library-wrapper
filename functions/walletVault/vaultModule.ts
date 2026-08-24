/**
 * Loads `@qubic.org/vault` — Node/CommonJS variant.
 *
 * The package is ESM-only: its `exports` map has no `require` condition. tsc emits CommonJS
 * (see tsconfig `module`), so a plain `import` — or even a plain `import()`, which tsc
 * downlevels to `require()` — throws `ERR_PACKAGE_PATH_NOT_EXPORTED` and kills the `pkg`-built
 * CLIs on startup. Wrapping the dynamic import in `new Function` keeps it a real `import()`
 * through downlevelling, which Node resolves fine from CommonJS.
 *
 * Bundlers use `vaultModule.browser.ts` instead (mapped via the `browser` field in
 * package.json), because a dynamic import would make Parcel emit a separate async chunk and
 * the webview only ever loads the single HTML file.
 */
let vaultModulePromise: Promise<any> | null = null;

export function loadVaultModule(): Promise<any> {
  if (!vaultModulePromise) {
    vaultModulePromise = (
      new Function("s", "return import(s)") as (s: string) => Promise<any>
    )("@qubic.org/vault");
  }
  return vaultModulePromise;
}
