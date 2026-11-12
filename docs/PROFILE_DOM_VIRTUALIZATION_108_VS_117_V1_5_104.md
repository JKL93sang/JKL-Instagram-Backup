# v1.5.104 TEST — PROFILE 117/117 blocked by virtualized DOM 108/117

## Origin: actual Firefox exports supplied on 12 November 2026, 23:17 local

- User-supplied `petit._tigre - Instagram Backup Logs - 2026-11-12_23-17-06.txt`: **v1.5.103**, 79 entries preserved, 0 removed, full selected scan `192.78 s`, `SCAN FINISHED — INCOMPLETE`.
- User-supplied `petit._tigre - Instagram Backup Manifest(2).json`: generated `2026-11-12T22:17:12.085Z`. This is a manifest of source observations and expected paths, **not** a complete filesystem hash inventory.
- The blocker is explicit in the log: `PROFILE strict DOM media-info supplement unavailable: profile_dom_main_count_or_membership_mismatch`. Every selected coverage guard **except PROFILE** is true.

## Exact set arithmetic, checked directly from the exported manifest

| Evidence | Number | Notes |
| --- | ---: | --- |
| Authenticated media_count | 117 | Expected main PROFILE parent roots |
| PUBLIC roots | 89 | Server ended |
| Native PROFILE roots | 105 | Server ended; 79 overlap with PUBLIC |
| PUBLIC ∪ native | 115 | 89 + 105 − 79 |
| Main PROFILE snapshot | 117 | 65 POST / 52 REEL before the separate REELS scan |
| DOM permalink roots seen over scroll | 108 | Subset of main, not a full persistent view |
| Main − DOM | 9 | **All nine are already in PUBLIC/native union** |
| Main − (PUBLIC ∪ native) | 2 | **Both are present in DOM** |
| Independent native REELS | 361 | 309 outside main; never a PROFILE parent completion source |
| Fully hydrated owned roots | 426/426 | No failure |
| Media queue | 789 | POST 229; REEL 361; HIGHLIGHT 192; TAGGED 6; AVATAR 1 |

The exact 9 main-grid parent IDs absent from DOM, **all independently verified in PUBLIC/native**, are:

`2419245961158063753`, `2545149430707088528`, `2636716332417102795`, `2638025839013301123`, `2639510586179766914`, `2642364785423944109`, `2695354948587171422`, `2698065272121707848`, `2706228087441525388`.

The exact two exceptions absent from PUBLIC/native, but visible in the DOM and hydrated by their targeted media-info requests, are:

- `3153889526261377396` → [CvE3dBpoml0](https://www.instagram.com/p/CvE3dBpoml0/) (3 photos).
- `3285109440665201171` → [C2XDaGLIaoT](https://www.instagram.com/p/C2XDaGLIaoT/) (6 photos).

Both were separately recovered via SOLO before this scan; the user previously reported folder-inventory total **789**. The new v1.5.103 manifest still has **780 historical batch ledger entries**, which SOLO does **not** write; do not interpret this as nine missing physical files.

## Root cause (actual v1.5.103 code)

`assessProfileDomApiSupplementProof()` required `dom.size === expected` AND `every main ID in DOM`. This is excessive because Instagram's UI can load and unmount/virtualize grid tiles, or the DOM observer can start after the first native roots have been recorded. A server-verified PUBLIC/native root does not need to be simultaneously observed in the DOM. In this real scan, 9 perfectly valid roots disappeared from / were never recorded in the DOM while all 2 truly missing roots *were* DOM-observed. The code rejected at the earlier DOM-size check **before** evaluating the per-root proof.

## Minimal fix — v1.5.104 TEST

Change only the strict supplemental condition:

1. Retain all original `assessProfileGridCrossSurfaceProof()` checks (authenticated ID and official counter, PUBLIC/server-end, native/server-end, genuine pagination, hydration complete, HIDDEN/EXCLUSIVE safe).
2. Retain `main.size === authenticatedExpected`, PUBLIC/native union subset of main, and **DOM ⊆ main** (no unrelated external DOM item).
3. **Do not require all main-grid IDs to appear in the DOM.** Only each ID in `main − (PUBLIC ∪ native)` must:
   - appear in DOM;
   - be present in `verifiedProfileDomApiRootIds`, populated from strict same-target `/media/<id>/info/` response;
   - be an authenticated POST, not a REEL;
   - have all carousel child IDs and URLs present (already checked by the v1.5.103 strict validator).
4. A negative result now logs counts for `main`, `observed_dom`, `verified_dom_api`, `public_native_union`. Do **not** invent missing IDs and do not use the independent REELS tab to fill main-grid gaps.
5. Do not change SOLO, DOWNLOAD MISSING, folder inventory, archive filenames, or any Internet endpoint.

## Regression and release

`tests/profile-dom-media-info-bridge-regression.test.mjs` now reproduces **exact real cardinalities** 117 main / 108 DOM / 115 PUBLIC∪native / 2 independently verified DOM-only POST roots / 9 independently-proven-but-not-DOM roots. Success requires all strict original guards and both DOM-only proofs; removing either missing root from DOM, inserting a foreign DOM link or weakening pagination/identity/HIDDEN still rejects COMPLETE. Other pre-existing negative regressions remain active.

[GitHub Actions #43319024155 — SUCCESS](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/43319024155) for v1.5.104 code and updated tests (commit `2cd774688a5c85f8e73e85f4e3d355ea2beb8604`). The technical documentation commit may trigger a later CI run; use that latest green run for final HEAD verification.

**Next live acceptance:** install TEST v1.5.104, scan once on `@petit._tigre` with the unchanged usual category selection, **no download necessary**. If Instagram still returns the required independent evidence, expect `proof=public_native_dom_api_exact_counter_proof`, `PROFILE=true` and `SCAN FINISHED — COMPLETE`; otherwise inspect the newly logged counts and actual failing condition. No merge or claim of live success without that evidence. PR #18 stays DRAFT, `main` v1.5.78 untouched.
