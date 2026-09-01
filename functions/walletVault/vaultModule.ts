/**
 * Loads `@qubic.org/vault` — Node/CommonJS variant. `new Function` is what keeps this a real
 * `import()` through tsc's CommonJS downlevelling; a plain `import` or `import()` becomes a
 * `require()`, which cannot load an ESM-only package and kills the CLI on startup.
 *
 * Bundlers get `vaultModule.browser.ts` instead, via the `browser` field in package.json.
 * Both halves are load-bearing — see *The ESM/CommonJS problem* in migration-test/README.md
 * before changing either, and re-run the two checks it lists.
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
