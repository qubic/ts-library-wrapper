// End-to-end test of the wrapper's vault bridge functions (the ones Flutter calls),
// running the COMPILED dist exactly as the CLI/webview would.
// Run: node migration-test/test-bridge.mjs   (from ts-library-wrapper/)
import { readFileSync } from 'node:fs';
import { runBrowser } from './bundle-esm.mjs';

const te = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString('base64');
const line = (t) => console.log('\n===== ' + t + ' =====');
let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

// ---------- fixtures ----------
const myVault = readFileSync(new URL('./legacy-v1-sample.qubic-vault', import.meta.url));
const myExpected = JSON.parse(readFileSync(new URL('./legacy-v1-sample.expected.json', import.meta.url), 'utf8'));
const hisVault = readFileSync(new URL('./his-test.qubic-vault', import.meta.url));

// build a v1 vault containing a WATCH-ONLY account (the case the pending fix breaks on)
async function buildWatchOnlyV1(password) {
  const subtle = globalThis.crypto.subtle;
  const RSA = { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: { name: 'SHA-256' } };
  const AES = { name: 'AES-GCM', length: 256, iv: new Uint8Array(12).fill(0) };
  const bb = (b) => Buffer.from(new Uint8Array(b)).toString('base64');
  const kp = await subtle.generateKey(RSA, true, ['encrypt', 'decrypt']);
  const pub = await subtle.exportKey('jwk', kp.publicKey);
  const realSeed = 'q'.repeat(55);
  const encN = await subtle.encrypt({ name: 'RSA-OAEP' }, kp.publicKey, te.encode(realSeed));
  const seeds = [
    { encryptedSeed: bb(encN), alias: 'Normal', publicId: 'A'.repeat(60), isOnlyWatch: false },
    { encryptedSeed: '', alias: 'WatchOnly', publicId: 'B'.repeat(60), isOnlyWatch: true },
  ];
  const pk = await subtle.importKey('raw', te.encode(password), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']);
  const wk = await subtle.deriveKey({ name: 'PBKDF2', salt: new Uint8Array(16), iterations: 100000, hash: 'SHA-256' }, pk, AES, true, ['wrapKey']);
  const jsonKey = await subtle.wrapKey('jwk', kp.privateKey, wk, AES);
  const vf = { privateKey: bb(jsonKey), publicKey: pub, configuration: { seeds, publicKey: pub, webBridges: [], useBridge: false, tickAddition: 10, enableBeta: false } };
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ik = await subtle.importKey('raw', te.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  const ek = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, ik, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, ek, te.encode(JSON.stringify(vf))));
  return { bytes: te.encode(JSON.stringify({ salt: bb(salt), iv: bb(iv), cipher: bb(cipher) })), realSeed };
}

// ---------- 1) legacy v1 import (my fixture) ----------
line('1) wallet.importVault on a legacy v1 vault (known seeds)');
{
  const res = await runBrowser('wallet.importVault', myExpected.password, b64(myVault));
  check('status ok', res.status === 'ok', res.error ?? '');
  const got = (res.seeds ?? []).map((s) => s.seed);
  console.log('   seeds:', got.map((s) => s.slice(0, 10) + '…'));
  check('all expected seeds recovered', myExpected.seeds.every((e) => got.includes(e.seed)));
  check('publicIds preserved', myExpected.seeds.every((e) => res.seeds.some((s) => s.publicId === e.publicId)));
}

// ---------- 2) legacy v1 import (Alex's own fixture) ----------
line("2) wallet.importVault on alez's test.qubic-vault");
{
  const res = await runBrowser('wallet.importVault', 'test1234', b64(hisVault));
  check('status ok', res.status === 'ok', res.error ?? '');
  const s = res.seeds?.[0];
  console.log('   seed:', s?.seed?.slice(0, 10) + '…', '| alias:', s?.alias);
  check('seed is a valid 55-char seed', /^[a-z]{55}$/.test(s?.seed ?? ''));
}

// ---------- 3) WATCH-ONLY v1 vault (the case that breaks the pending upstream fix) ----------
line('3) wallet.importVault on a v1 vault containing a WATCH-ONLY account');
{
  const { bytes, realSeed } = await buildWatchOnlyV1('pw');
  const res = await runBrowser('wallet.importVault', 'pw', b64(bytes));
  check('status ok (did NOT throw)', res.status === 'ok', res.error ?? '');
  const normal = res.seeds?.find((s) => s.alias === 'Normal');
  const watch = res.seeds?.find((s) => s.alias === 'WatchOnly');
  check('normal account seed recovered', normal?.seed === realSeed);
  check('watch-only returned with empty seed', watch?.seed === '' && watch?.isOnlyWatch === true);
}

// ---------- 4) version detection ----------
line('4) wallet.getVaultVersion');
{
  const v1 = await runBrowser('wallet.getVaultVersion', b64(myVault));
  check('legacy vault reports version 1', v1.version === 1, 'got ' + v1.version);
}

// ---------- 5) v3 write → read round-trip through the bridge ----------
line('5) wallet.createVaultFileV3 → wallet.importVault round-trip');
{
  const seedsJSON = JSON.stringify([
    { alias: 'Acct A', seed: 'x'.repeat(55), publicId: 'C'.repeat(60), isOnlyWatch: false },
    { alias: 'Watch B', seed: '', publicId: 'D'.repeat(60), isOnlyWatch: true },
  ]);
  const created = await runBrowser('wallet.createVaultFileV3', 'pw-v3', seedsJSON);
  check('v3 vault created', created.status === 'ok' && !!created.base64, created.error ?? '');

  const ver = await runBrowser('wallet.getVaultVersion', created.base64);
  check('new vault reports version 3', ver.version === 3, 'got ' + ver.version);

  const back = await runBrowser('wallet.importVault', 'pw-v3', created.base64);
  check('v3 unlock ok', back.status === 'ok', back.error ?? '');
  const a = back.seeds?.find((s) => s.alias === 'Acct A');
  const b = back.seeds?.find((s) => s.alias === 'Watch B');
  check('v3 seed round-trips', a?.seed === 'x'.repeat(55));
  check('v3 watch-only round-trips', b?.seed === '' && b?.isOnlyWatch === true);
}

// ---------- 6) wrong password still rejected ----------
line('6) wrong password is rejected');
{
  const res = await runBrowser('wallet.importVault', 'definitely-wrong', b64(myVault));
  check('returns error status', res.status === 'error', 'status=' + res.status);
}

// ---------- 7) legacy writer untouched (lockstep) ----------
line('7) wallet.createVaultFile still writes LEGACY v1 (rollout lockstep)');
{
  const seedsJSON = JSON.stringify([{ alias: 'L', seed: 'y'.repeat(55), publicId: 'E'.repeat(60), isOnlyWatch: false }]);
  const created = await runBrowser('wallet.createVaultFile', 'pw-v1', seedsJSON);
  check('created', created.status === 'ok', created.error ?? '');
  const ver = await runBrowser('wallet.getVaultVersion', created.base64);
  check('still version 1', ver.version === 1, 'got ' + ver.version);
  const back = await runBrowser('wallet.importVault', 'pw-v1', created.base64);
  check('round-trips through new importer', back.seeds?.[0]?.seed === 'y'.repeat(55));
}

console.log(`\n${failures === 0 ? '✅ ALL BRIDGE TESTS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
