# Vault migration — `@qubic.org/vault` integration + fixtures

The wrapper reads vault files through **`@qubic.org/vault`** (currently `1.2.1`), with a fallback
to its own legacy importer. This folder holds the fixtures and the end-to-end tests that prove it.

**Status: done and verified on Android.** What remains is listed under *Open items* below.

## Run the tests

Neither script here needs its own `node_modules` — both use only `node:fs` and the local bundle.
Run `npm install` in `ts-library-wrapper/` first so the bundle can be built.

```bash
cd ts-library-wrapper
npx esbuild functions/index.ts --bundle --format=esm --platform=node \
  --outfile=migration-test/bundle-esm.mjs \
  --banner:js="import{createRequire as __cr}from'module';const require=__cr(import.meta.url);"
node migration-test/test-bridge.mjs      # end-to-end bridge tests (the functions Flutter calls)
```

`bundle-esm.mjs` mirrors the Parcel/webview build (ESM). The `--banner` only exists so the
bundle can run under Node; in the real webview the code takes the `globalThis.crypto` branch.

`node migration-test/gen-v1-vault.mjs` regenerates the legacy fixture from scratch using the
old algorithm. It **overwrites** `legacy-v1-sample.*` with freshly randomised seeds, so run it
only when you want a new fixture — the committed pair is already consistent.

These tests are not wired into `npm test`. Jest cannot load `@qubic.org/vault` (ESM-only, no
`require` condition) without extra `transformIgnorePatterns` / babel plumbing and a v7-pinned
`@babel/preset-env`, and jest is separately broken on `main` for an unrelated reason
(`crypto/index.js` is ESM and every suite that imports `functions/index.ts` fails). Making these
run under jest is its own change.

## What was implemented

| Bridge function | Behaviour |
|---|---|
| `wallet.importVault` | Reads **v1 and v3**. Same JSON contract as before, so Flutter needs no change. |
| `wallet.importVaultFile` | Same, for the CLI path. |
| `wallet.getVaultVersion` | **New.** Returns 1 or 3 without decrypting. |
| `wallet.createVaultFileV3` | **New.** Writes a v3 (Argon2id) vault. Not yet used by any app. |
| `wallet.createVaultFile` | **Unchanged — still writes v1.** See rollout below. |

Implementation lives in [`functions/walletVault/`](../functions/walletVault/):
`vaultService.ts` holds the logic, `index.ts` registers the bridge functions, and
`vaultModule.ts` / `vaultModule.browser.ts` load the library differently per build target —
see *The ESM/CommonJS problem* below before changing either.

The rebuilt asset was copied to `wallet-app/assets/qubic_js/qubic-helper-html-3_2_0.html` and
`Config.qubicJSAssetPath` (`wallet-app/lib/config.dart`) points at it. The previous
`qubic-helper-html-3_1_3.html` is still present, so rollback is a one-line revert.

## Upstream history (why `1.2.1` exists)

`@qubic.org/vault@1.2.0` **silently dropped v1 seeds**: `unlockV1` copied `publicId`/`alias` and
never RSA-decrypted `encryptedSeed`, so importing a legacy vault produced accounts with no keys,
and `upgrade()` produced a v3 vault with no seed material (silent fund loss). Reported upstream
with a repro from this folder.

alez fixed it in qubic/qubic-typescript#27, but that fix **threw on any vault containing a
watch-only account** (`encryptedSeed: ""` → RSA-OAEP rejects an empty ciphertext). We added the
guard + regression tests to that PR (commit `1b5ce306`, `fix(vault): unlock v1 vaults with
watch-only accounts`). PR #27 is merged; sally published **`1.2.1`** manually.

## Why there is still a fallback

`unlockVault()` uses `@qubic.org/vault`, and falls back to the wrapper's own `WalletImporter`
whenever the library cannot fully recover a legacy vault. This keeps legacy imports correct on
**every** version of the library:

| Installed library | Legacy (v1) import | Watch-only in vault |
|---|---|---|
| `1.2.0` — drops v1 seeds | fallback → ✅ correct | ✅ |
| PR #27 branch — recovers seeds, throws on watch-only | library → ✅ | fallback → ✅ |
| **`1.2.1` (current)** — both fixed | library → ✅ | library → ✅ |

With `1.2.1` the fallback is no longer exercised, so it can be deleted — but it is cheap
insurance and costs nothing while other wallets are still migrating. Removing it is a deliberate
follow-up, not an oversight.

## Rollout (important — do not skip)

A v3 vault **cannot be read by any wallet that has not shipped a v3 reader**. So:

1. Ship the **reader** everywhere first (web, extension, mobile) — that is what this change does.
2. Keep exporting **v1** (`wallet.createVaultFile`) until all three can read v3.
3. Only then switch the default export to `wallet.createVaultFileV3`.

This is why `createVaultFile` was deliberately left on v1. Flipping it early would let a user
export on mobile and be unable to import on web.

## Verified on a real Android emulator (v2.5.0 build 93)

Driven through the actual app UI, not just Node:

- import legacy v1 vault ✅ · import v1 vault **containing a watch-only account** ✅ (the bug we fixed)
- import **v3** vault ✅ (new capability for mobile) · wrong password → clean error ✅
- corrupt/non-vault file → `INVALID VAULT FILE` ✅ · export vault ✅ (verified v1, seeds intact)
- create account ✅ · delete account ✅ · full wipe → restore from exported backup ✅
  (balance and all 4 accounts came back identical)

Browser-verified timings for the v3 path (desktop Chrome). Warm, repeated calls: create
~765 ms, unlock ~409 ms. First call after page load, which pays module init as well:
create ~2543 ms, unlock ~1143 ms. On a low-end Android expect roughly 2–3 s for a v3 unlock —
Argon2id at 64 MB is the cost. Legacy v1 import is unaffected.

## Verified on the shipped asset itself

`test-bridge.mjs` exercises an esbuild ESM bundle, which is not the artifact that ships. The
Parcel-built `qubic-helper-html-3_2_0.html` was therefore also driven directly in Chrome, served
over `http://localhost` so `crypto.subtle` is available (a `file:`/`data:` URL is not a secure
context and the crypto calls silently disappear):

```bash
cd wallet-app/assets/qubic_js && python3 -m http.server 8770 --bind 127.0.0.1
# then in the page console, call window.runBrowser('wallet.…', …)
```

All 10 checks passed: v3 create → version byte 3 → unlock returns both accounts, seed and
publicId round-trip byte-exact, watch-only comes back empty and flagged, `createVaultFile`
still writes v1 and that v1 reads back through the new importer, and both a wrong password and
a garbage file return a clean `{status:"error"}` rather than throwing. Console was clean, and
the network log showed **only** the HTML being fetched — no async chunk.

Note the bridge signals failure by **returning** `{status:"error", error:"…"}` — it does not
throw. A test that only wraps the call in `try/catch` will report a false failure.

## Open items

1. **Remove the fallback** in `vaultService.ts` once every wallet is on `1.2.1`+ (see above).
2. **`@qubic.org/wallet` still breaks on watch-only vaults** — `packages/wallet/src/vault.ts:58`
   does `toSeed(entry.publicId)` for seedless entries, and a 60-char identity is never a valid
   55-char seed, so it throws. Needs an API decision upstream (filter those entries out =
   non-breaking but silently drops accounts; richer return type = breaking). Not our blocker —
   the wrapper does not use that package.
3. **Argon2id params are not tuned for low-end devices.** A real low-end Android measured
   **2936 ms** for 64 MB/t3 Argon2id. `@qubic.org/vault` ships `64 MB / t=3 / p=4` as the default
   and the params are **not stored in the envelope**, so every wallet must agree on one set.
   Worth raising upstream (e.g. version-byte presets) before v3 export is switched on.
4. **v3 in the packaged CLIs** — they build and run, and read v1 exactly as before, but cannot
   read or write v3 (see the ESM section below). Only affects Flutter desktop.
5. Untested: iOS simulator, and a real signed transaction after import.

## The ESM/CommonJS problem and how it is handled

`@qubic.org/vault` is ESM-only: its `exports` map has no `require` condition and the package is
`"type": "module"`. The wrapper has to satisfy two very different consumers, so the import is
split into two files selected by the `browser` field in package.json:

| File | Used by | Why |
|---|---|---|
| `vaultModule.ts` | tsc → `dist/` (CommonJS, the CLIs) | `new Function("s","return import(s)")` — tsc downlevels a plain `import()` back into the `require()` we are avoiding, and a top-level import throws `ERR_PACKAGE_PATH_NOT_EXPORTED` at load |
| `vaultModule.browser.ts` | Parcel → the webview HTML | a **static** import, so Parcel inlines the library into the single self-contained file |

Both halves are load-bearing, and each one breaks a different target if you "simplify" it:

- Give the browser a dynamic import and Parcel emits a **separate 74 kB async chunk**. Flutter
  ships only the HTML, so the chunk is never fetched and every vault call fails at runtime.
- Give Node a static import and `dist/functions/index.js` throws the moment it loads, taking the
  whole CLI down — not just the vault functions.

Verify after touching this: `ls dist/` after `npm run build-html` must show **one** file, and
`node -e "require('./dist/functions/index.js')"` must not throw.

### The packaged CLIs are a third case

`pkg` snapshots cannot evaluate a dynamic `import()` at all — they fail with
`TypeError: Invalid host defined options`. So inside `qubic-helper-{win,linux,mac}` the library
is simply unavailable. `tryNewVaultManager()` returns `null` there and the callers degrade:

- v1 vaults are read by the wrapper's own importer — **identical to the behaviour before this
  change**, which is what those binaries did anyway.
- v3 read/write returns a plain `"not supported by this build"` message instead of an opaque
  V8 error.
- Version detection falls back to reading the first byte (`{` = v1, otherwise the version byte).

Giving the packaged CLIs real v3 support needs an ESM-aware bundling step before `pkg`, or
dropping `pkg` for something that understands ESM. Not done here.

## Fixtures

- `legacy-v1-sample.qubic-vault` — a v1 vault generated by `gen-v1-vault.mjs` using the exact
  legacy algorithm (PBKDF2-100k outer, RSA-OAEP-4096 seeds, zero-salt inner wrap).
- `legacy-v1-sample.expected.json` — its password and expected plaintext seeds.
- `his-test.qubic-vault` — alez's own fixture, byte-identical to the copy already committed in
  qubic-typescript at `packages/vault/src/__tests__/test.qubic-vault` (password `test1234`).

**The seeds in `legacy-v1-sample.*` are synthetic and attach to no real identity** — the fixture
generator fills `publicId` with `randUpper(60)` rather than deriving it, so the recovered seeds
do not match their stored identities. That is deliberate: the fixture exercises the vault
*format*, not key derivation. Verify with `createPublicId` before adding any new fixture.

`his-test.qubic-vault` is the exception: its stored `publicId` **does** derive from its seed, so
it is real wallet-generated key material. It is already public upstream, but do not create more
fixtures like it — use `gen-v1-vault.mjs`.
