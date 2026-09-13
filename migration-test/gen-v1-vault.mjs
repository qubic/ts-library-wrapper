// Generates a REAL v1 (.qubic-vault) file using the EXACT algorithm the existing
// ts-library-wrapper uses (functions/walletKeyManagement/shared/walletService.ts):
//   outer:  AES-256-GCM, key = PBKDF2-SHA256(password, random16 salt, 100000)
//   inner:  RSA-OAEP-4096 private key (JWK) wrapped with AES-256-GCM,
//           key = PBKDF2-SHA256(password, ZERO16 salt, 100000), iv = ZERO12
//   seeds:  each 55-char seed RSA-OAEP(SHA-256) encrypted with the vault public key
// On-disk file = UTF-8 JSON { salt, iv, cipher } (all base64) — exactly what the
// web wallet writes and what the wallet-app writes after base64-decoding the bridge result.
//
// Run: node gen-v1-vault.mjs
import { writeFileSync } from 'node:fs';

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
const RSA = { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: { name: 'SHA-256' } };
const AES = { name: 'AES-GCM', length: 256, iv: new Uint8Array(12).fill(0) }; // fixed zero IV for the inner key-wrap
const ENC = { name: 'RSA-OAEP' };
const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64');

const PASSWORD = 'test-vault-password';
const randLower = (n) => { const a = 'abcdefghijklmnopqrstuvwxyz'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * 26)]; return s; };
const randUpper = (n) => { const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * 26)]; return s; };

const inputSeeds = [
  { alias: 'Main Account',    seed: randLower(55), publicId: randUpper(60), isOnlyWatch: false },
  { alias: 'Savings Account', seed: randLower(55), publicId: randUpper(60), isOnlyWatch: false },
];

// --- PBKDF2 helpers (identical params to walletService.ts) ---
async function importPwKey(pw) { return subtle.importKey('raw', te.encode(pw), { name: 'PBKDF2' }, false, ['deriveBits', 'deriveKey']); }
async function deriveWrapKey(pwKey) {
  const salt = new Uint8Array(16).fill(0); // HARD-CODED zero salt (the v1 flaw)
  return subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, pwKey, AES, true, ['wrapKey', 'unwrapKey']);
}
async function getVaultFileKey(pw, salt) {
  const ik = await subtle.importKey('raw', te.encode(pw), { name: 'PBKDF2' }, false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, ik, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function createV1Vault() {
  // 1) new RSA keypair
  const kp = await subtle.generateKey(RSA, true, ['encrypt', 'decrypt']);
  const pubJwk = await subtle.exportKey('jwk', kp.publicKey);

  // 2) encrypt each seed with the RSA public key (addSeed)
  const seeds = [];
  for (const s of inputSeeds) {
    const enc = await subtle.encrypt(ENC, kp.publicKey, te.encode(s.seed));
    seeds.push({ encryptedSeed: b64(enc), alias: s.alias, publicId: s.publicId, isOnlyWatch: false });
  }

  // 3) wrap the RSA private key (createJsonKey)
  const pwKey = await importPwKey(PASSWORD);
  const wrapKey = await deriveWrapKey(pwKey);
  const jsonKey = await subtle.wrapKey('jwk', kp.privateKey, wrapKey, AES);

  // 4) inner IVaultFile
  const configuration = {
    name: 'exported', seeds, publicKey: pubJwk,
    webBridges: ['wss://webbridge.qubic.li'], useBridge: false, tickAddition: 10, enableBeta: false,
  };
  const vaultFile = { privateKey: b64(jsonKey), publicKey: pubJwk, configuration };

  // 5) encrypt the whole thing (encryptVault) with random salt/iv
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getVaultFileKey(PASSWORD, salt);
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(vaultFile))));

  return { salt: b64(salt), iv: b64(iv), cipher: b64(cipher) };
}

// --- self round-trip read (port of walletImporter.ts) to prove the file is valid ---
async function readV1Vault(fileJson, pw) {
  const enc = JSON.parse(fileJson);
  const salt = Uint8Array.from(Buffer.from(enc.salt, 'base64'));
  const iv = Uint8Array.from(Buffer.from(enc.iv, 'base64'));
  const cipher = Uint8Array.from(Buffer.from(enc.cipher, 'base64'));
  const key = await getVaultFileKey(pw, salt);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher));
  const vault = JSON.parse(new TextDecoder().decode(plain));

  const wrapped = Uint8Array.from(Buffer.from(vault.privateKey, 'base64'));
  const pwKey = await importPwKey(pw);
  const wrapKey = await deriveWrapKey(pwKey);
  const priv = await subtle.unwrapKey('jwk', wrapped, wrapKey, AES, RSA, true, ['decrypt']);

  const out = [];
  for (const s of vault.configuration.seeds) {
    const dec = await subtle.decrypt(ENC, priv, Uint8Array.from(Buffer.from(s.encryptedSeed, 'base64')));
    out.push({ alias: s.alias, publicId: s.publicId, seed: new TextDecoder().decode(dec) });
  }
  return out;
}

const encrypted = await createV1Vault();
const fileJson = JSON.stringify(encrypted);
writeFileSync(new URL('./legacy-v1-sample.qubic-vault', import.meta.url), fileJson);
writeFileSync(new URL('./legacy-v1-sample.base64.txt', import.meta.url), Buffer.from(fileJson).toString('base64'));

// self-verify
const readBack = await readV1Vault(fileJson, PASSWORD);
const expected = inputSeeds.map((s) => ({ alias: s.alias, publicId: s.publicId, seed: s.seed }));
const ok = JSON.stringify(readBack) === JSON.stringify(expected);
writeFileSync(new URL('./legacy-v1-sample.expected.json', import.meta.url), JSON.stringify({ password: PASSWORD, seeds: expected }, null, 2));

console.log('password:', PASSWORD);
console.log('file bytes:', fileJson.length, '| first char:', JSON.stringify(fileJson[0]), '(0x' + fileJson.charCodeAt(0).toString(16) + ')');
console.log('expected seeds:', expected.map((s) => s.seed.slice(0, 8) + '…'));
console.log('self round-trip (create → read back):', ok ? '✅ VALID v1 vault' : '❌ MISMATCH');
if (!ok) { console.log('got:', readBack); console.log('exp:', expected); process.exit(1); }
