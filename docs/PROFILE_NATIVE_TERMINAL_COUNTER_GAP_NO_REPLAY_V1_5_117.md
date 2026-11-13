# v1.5.117 — Native PROFILE terminal + counter gap: no unsafe Relay replay (TEST)

## Real Firefox source evidence (2026-11-13)

Private TXT/JSON analyzed in ChatGPT, **not uploaded to GitHub**: `b_kkaaa - Instagram Backup Logs - 2026-11-13_19-27-56.txt` and `b_kkaaa - Instagram Backup Manifest(8).json`.

- Experimental v1.5.116 captures native `initial=1, continuation=10, lastHasNext=false`, and `native=121` target-scoped roots (114 POST + 7 REEL), confirming the original 10 missing historical parent identities. This reproduces the sanitized HAR.
- 170 current queued media records = 163 POST media + 7 REEL media, up from 147 records in v1.5.115; **all 147 earlier IDs are included**, 23 newly captured POST media are already known in the prior 836-receipt historical ledger, and **all unchanged records keep the same archive path**.
- The authenticated Instagram count reads **122**, while the browser-native profile feed explicitly ends at **121**. v1.5.116 calls `profileCompletionRequirement()`, gets `native_below_ig_counter`, replays `PolarisProfilePostsQuery` from page 1 via `webRelayGql`, gets `server_execution` with 5 GraphQL errors, declares `IG_API_UNHEALTHY` and stops the **entire scan before REELS, hydration, historical audit, accessible partial grant, and final verdict**. This is a demonstrably unnecessary dangerous replay of a feed already ended natively.
- Because the test scan aborted, the manifest's `mainGridSnapshot=0`, `hydration=0`, `historicalRootCount=0` are **unfinished scan state**, not evidence those roots vanished. Its `records=170` and native provenance still evidence the successful capture.
- The new manifest's `ledger: {}` contrasts the **836 unchanged historical entries** in manifest (7). The exported ledger reads userscript-local `GM_getValue(APP.DB)` via `loadDb()`. A blank store in this running installation/session is *not* proof that previously downloaded files have been deleted. Do **not** download again or reset storage to test this. Compare userscript installs/isolated storage later; no auto-merge or pseudo-receipts.

## Implementation

- New read-only `profileNativeTerminalCounterGapProof(requirement)` proves an **isolated numeric gap** while requiring matching authenticated owner, exact active scan identity/session, valid real initial and continuation request contracts, browser-native `initial>=1, continuation>=1, lastHasNext=false`, server `has_next_page=false`, and each native root resolved into the owned POST/REEL inventory.
- Before any GraphQL fallback is called in `scanMainGrid()`, this exact condition is checked. If fulfilled, **skip ALL script-generated native PROFILE replay**, log the counter discrepancy, continue DOM, connected sources, REELS, and deep hydration. Deliberately keep `navigationEnded=false` and `coverage.profileGrid=false` to avoid a fabricated complete archive due to the 122/121 mismatch. Other missing-proof cases retain the prior strict fallback logic.
- New synthetic production-helper test `tests/profile-native-terminal-no-replay-v1-5-117.test.mjs` verifies true-case 3/4 gap and negative cases (wrong owner, missing first contract, missing terminal evidence, stale scan timestamp, unverified root, wrong cursor target, mixed other reasons), and that the guard occurs before the fallback.
- Previous v1.5.116 strict GraphQL partial-response handling and JSON-lines native parser unchanged. No new Instagram network requests or archive writes. Experimental based on prior PR #30 and PR #29; stable main untouched.

## Remaining distinct issues

1. Server counter `122` versus pagination 121; do not fabricate the 122nd parent.
2. Carousel native media-info hints at 6 units but only exposes 5 children; must not fabricate the missing unit.
3. Understand why new Tampermonkey run sees blank userscript-local ledger while previous manifest preserved 836 entries; do not equate this to physical file loss.

**Next real test once all CI checks pass:** Install v1.5.117, POST+REEL only, SCAN only (no downloads or resets). Export full TXT and JSON. Expected first-page+terminal native proof retained, scan proceeds through connected sources/REELS/DEEP HYDRATION, final **INCOMPLETE** unless independent strict evidence truly reconciles all gaps; verify 170 queue, historical ledger source isolation and no false completeness.