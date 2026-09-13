// wallet.createVaultFile writes v3 where Web Crypto is present (the browser/HTML asset) and
// falls back to v1 where it is not (the pkg-built desktop CLIs on Node 16, which has no
// globalThis.crypto). The bridge tests only ever see the v3 side, so this runs the same
// createVaultFile against the same bundle with the global present and then deleted.
// Run: node migration-test/test-export-fallback.mjs   (from ts-library-wrapper/)
import { runBrowser } from './bundle-esm.mjs';

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${extra ? ' - ' + extra : ''}`);
  if (!ok) failures++;
};
const seedsJSON = JSON.stringify([
  { alias: 'Main', seed: 'a'.repeat(55), publicId: 'A'.repeat(60), isOnlyWatch: false },
]);

console.log('\n===== Web Crypto present (browser / HTML asset) =====');
{
  const created = await runBrowser('wallet.createVaultFile', 'pw', seedsJSON);
  check('created', created.status === 'ok', created.error ?? '');
  const ver = await runBrowser('wallet.getVaultVersion', created.base64);
  check('writes v3', ver.version === 3, 'got ' + ver.version);
}

console.log('\n===== Web Crypto removed (pkg / desktop CLI) =====');
{
  // The legacy WalletService brings its own webcrypto via require('crypto'), so the v1 writer
  // still works without the global; only the v3 path is gated on it.
  const saved = globalThis.crypto;
  delete globalThis.crypto;
  let created;
  try {
    created = await runBrowser('wallet.createVaultFile', 'pw', seedsJSON);
  } finally {
    globalThis.crypto = saved;
  }
  check('created', created.status === 'ok', created.error ?? '');
  const ver = await runBrowser('wallet.getVaultVersion', created.base64);
  check('falls back to v1', ver.version === 1, 'got ' + ver.version);
}

console.log(failures === 0 ? '\n✅ EXPORT FALLBACK OK' : `\n❌ ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
