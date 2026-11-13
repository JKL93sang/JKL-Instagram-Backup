# TEST v1.5.114 — PROFILE parent provenance audit (read-only)

**Date:** 2026-11-13. [Draft PR #28](https://github.com/JKL93sang/JKL-Instagram-Backup/pull/28). Official stable `main` remains v1.5.109. Builds on previously TEST-verified v1.5.111 historical POST archive folder continuity but **does not include** the v1.5.112–113 orphan TAGGED child probes.

## Independent problem: missing PROFILE evidence, not missing files

The user authorized comparison of historical archive manifests and three real PROFILE scans. The authenticated profile returned `media_count=122`; best full scan found **111 distinct main PROFILE + independent REELS parent root IDs**. Across real full passes, the detected main grid fluctuated **110 → 105** as the native first-page capture was missed; the 826 individual media unit IDs in the two complete inventories remained identical. A count gap must never be interpreted as 11 missing image files.

To compare the appropriate entities, canonicalize every historical `POST` or `REEL` receipt's shortcode (strip Instagram's exact 28-character private permalink access-context suffix, if present), then decode to the **parent** numeric Instagram PK. A carousel of five child images is **one parent root**.

**Private local-only forensic report** (not committed or copied here) confirms the historical ledger contains:
- **121 unique parent identities** with old `PROFILE_GRID_NATIVE` or `PROFILE_GRID_DOM` provenance; 109 have native evidence and 12 only DOM evidence.
- Of those historic parent IDs, **10** are absent from the best current 111-root PROFILE+REELS snapshot: 7 old native, 3 old DOM-only.
- Among these ten, **eight** still have one or more current child media units in the full archive queue via another selected surface. That *does not* prove their parent still appears in today's PROFILE.
- Two historical roots have no matching child units in the current full inventory. One of those two is still a **DOM permalink candidate** but cannot be authenticated as complete media.
- Its prior two actual Firefox logs returned the exact reason `incomplete_media_units`, *not HTTP 400*. This is distinct from the already-investigated unrelated TAGGED four-ID anomaly.
- The remaining arithmetic gap `122 - 121 = 1` is purely a difference of a current Instagram counter and an old root inventory, **not** evidence of a particular missing file, current owner root or deleted publication.

### Provenance weakness of the current PROFILE scanner

Real Firefox logs showed 0 captured **initial** native PROFILE request and 5–6 captured **continuation** requests, with a terminal `has_next_page=false`. A terminal page is insufficient when the first page's request contract has not been captured and proved. Native membership fluctuated 61 → 49; current DOM candidates remained 106. The script correctly refuses PROFILE completeness.

The TEST adds `profileSourceDiagnostics.nativeRequestProvenance`: initial requests, continuation requests, whether their distinct contracts were recorded, last has_next, and `observedEndWithoutFirstPageContract`. It neither manufactures a first-page request nor replays an untrusted Relay cursor. Earlier v1.5.91–92 attempts already established that reconstructed query replay can cause `server_execution` errors.

## Production helpers

- `reconcileHistoricalProfileRoots(input)` — pure and read-only: select only historically sourced native/DOM owned POST/REEL records; compute parent PKs from canonical shortcodes, deduplicate carousels, cross-check with current main root set and independent reel root set, current DOM candidate IDs, native records, and current media-unit IDs. Classify each old root as `current_dom_candidate_unverified`, `historical_root_with_current_media_only`, or `historical_root_not_in_current_selection`.
- `profileHistoricalRootAudit()` — inject actual per-user ledger and current scan sets. Exports `diagnostics.profileHistoricalRootAudit`. Writes compact `PROFILE HISTORICAL AUDIT` logs with per-parent differences **only when POSTS and REELS are both selected**. A TAGGED-only pass returns `PROFILE_HISTORICAL_COMPARISON_NOT_SELECTED`, deliberately **not** an unvalidated gap list.
- `profileDomHydrationFailures` — preserve explicit root/shortcode and sanitized `profileDomMediaInfoFailureCode`, including `incomplete_media_units`; or a bounded HTTP code when the request genuinely failed. Exported under `diagnostics.profileDomHydrationFailures` and summarized in TXT. Original `feedback_required` and HTTP 429 circuit breakers remain first priority.
- `profileSourceDiagnostics.nativeRequestProvenance` — first-page-versus-tail source safety record.

**Non-negotiable:** No new network requests, no speculative media ID guessing, no hidden-content access, no mutation of `state.roots` or media queue from old ledger, no claims of 100% PROFILE from DOM links or old downloadedAt receipts, no direct file download. TAGGED and Story-only logic are untouched.

## Tests and intended one-pass acceptance

The CI runs the existing regression suite plus synthetic `tests/profile-historical-root-audit-v1-5-114.test.mjs`: real pure production helper, synthetic parent shortcodes (short and suffix-appended), native/DOM provenance and arbitrary unsourced-record rejection, missing versus queued historic children, selection guards, non-mutating input, and the real async `hydratePermalinkRoots` with simulated HTTP 404 and authenticated-but-incomplete `incomplete_media_units`. The public full-scan integration harness was adapted to inject a mock read-only audit.

The **next** user test should enable only this TEST v1.5.114 script, select **POSTS + REELS only**, uncheck TAGGED / HIGHLIGHTS / STORY / AVATAR, then **SCAN**, export **TXT log AND JSON manifest**, and avoid download or ledger resets. This isolates native PROFILE pagination from TAGGED and 566 Highlights without introducing new Instagram requests. The result should either recover more real roots or characterize precisely the ten historically known but unverified parents. No success count is promised.

Script: `https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/test/profile-historical-root-audit-v1.5.114/JKL_Instagram_Backup.user.js`
