# TEST v1.5.111 — Real scan evidence, TAGGED count diagnostics and archive continuity

**2026-11-13, Europe/Paris.** Experimental [draft PR #25](https://github.com/JKL93sang/JKL-Instagram-Backup/pull/25). Stable `main` is **v1.5.109**, unchanged. Supersedes the live-ineffective v1.5.110 candidate in draft PR #24.

## The actual v1.5.110 user test — failure evidence

The user submitted the actual Firefox log `b_kkaaa - Instagram Backup Logs - 2026-11-13_05-15-12.txt` and `b_kkaaa - Instagram Backup Manifest(3).json`. Compare against the preserved v1.5.108 `03-44-44.txt` + `Manifest(2)`. **Private exports and raw Instagram URLs/cookies are never committed to this public repository.**

| Metric | Earlier real v1.5.108 | New real v1.5.110 |
|---|---:|---:|
| Private account global post count | 122 | 122 |
| Main PROFILE posts + reels | 110 (104 POST, 6 REEL) | 105 (100 POST, 5 REEL) |
| Captured native PROFILE IDs | 61 | 49 |
| DOM candidate IDs | 106 | 106 |
| Independent REELS | 7 | 7 |
| Distinct currently discovered OWNED roots | 111 | 107 |
| TAGGED root proof | 76/77 | 76/77 |
| Selected current media units | 826 | 826 |
| Historical ledger receipts | 836 | 836 |

**Exact export comparison:** all **826 current unit IDs** are identical; all **836 historical ledger record objects** are byte-equivalent after JSON parsing. The same carousel still advertises four slides but has three explicitly observed IDs, and the previous strict two-source helper produced **zero** accepted count anomalies (`count_hint_mismatches=0`). Therefore v1.5.110 is **not** a functional live fix.

**Important new phenomenon:** the native PROFILE session recaptured **12 fewer parent IDs** (49 instead of 61); only **five** of these were previously in the accepted main snapshot. One of the five is still independently verified as REEL. The **other four** were previously verified as native-owned POST units and recorded under `POSTS`, but were encountered only via TAGGED during this scan. Their current filename/category changed to `TAGGED - 2026_11_13` although their 2024 POST historical receipt is unchanged. This is an *archive path identity regression risk*, not disappearance of media. Never claim five deleted publications.

## Code changes in TEST v1.5.111

### 1. Explain why the carousel proof fails

Previously the v1.5.110 helper required *the same child IDs in the same order* in two different Instagram representations. Ordering is not evidence of missing media. The new helper compares **exact same unique positive child ID sets**; media type matching is by ID rather than array position. It continues to reject an actual different child ID, any extra `carousel_media_ids`/GraphSidecar edge child, incomplete pagination, pending child, shortcode/owner/parent/type contradictions, or unresolved media URL/disk provenance.

For an anomalous declared count where strict reconciliation still fails, the script now logs `TAGGED count hint proof rejected` with an **explicit reason** and safe evidence-shape fields (actual/declarative counts, list sizes, same set/order, optional independent ID list sizes, owner/code match flags, pending/child-page status). The UI `TAGGED rejected hints` shows the count. The manifest exports `diagnostics.taggedCountHintFailures`, one bounded record per affected root. No raw JSON, media URLs, cookie/header, browser credential or token is retained or sent.

A mismatch accepted as proof of **currently accessible** media still prints `TAGGED accessible carousel count hint mismatch` and is exported in `diagnostics.taggedCountHintMismatches`. In neither path is the unseen fourth media ID fabricated, nor is deletion asserted.

### 2. Avoid TAGGED↔POST archive filename drift

`restoreHistoricalTaggedPostArchive` runs only on currently identified TAGGED units. It restores historical **POST archive filename, original date and folder** if **all** checks pass:
- Numeric child unit ID exactly matches a prior historical ledger record in this same resolved profile;
- That historical record explicitly had `type:POST` and provenance `PROFILE_GRID_NATIVE` (not merely a TAGGED or unverified UI source);
- Current and historic canonical shortcode are both present and exactly equal;
- Historic timestamp is a positive safe integer and original filename exactly matches the name recomputed by current `filename()` for the same ID, type, extension and date;
- The current unit really exists in `state.queue` with `TAGGED` source provenance.

This is **file path continuity only**, not current PROFILE discovery. No `state.roots.POST` injection, no pretending native pagination ended, no synthetic media record or extra API call. If even one validation fails, original TAGGED classification remains unchanged. Diagnostic counts: log `TAGGED historical archive category preserved`, manifest `taggedHistoricalPostRestored`, UI `TAGGED legacy POST paths`.

When the selected TAGGED collection itself is proven complete, a restored historic POST remains eligible for download **via this current TAGGED proof**, not via fabricated PROFILE proof; positive and fail-closed cases are unit tested.

### 3. Validation of only TAGGED without a full scan

The existing scan selection already supports a **TAGGED-only** scan: uncheck POSTS, REELS, HIGHLIGHTS, STORY and AVATAR, leave only TAGGED checked. The scanner runs PROFILE INFO and TAGGED, but **skips** main PROFILE, reels, 566 highlight units, Story, Avatar and deep hydration. On the last real run, TAGGED took 21.34 seconds versus the complete scan of 82.59 seconds; this is *observed historical timing, not a promised duration for next run*.

In this mode, `SCAN FINISHED — COMPLETE` would prove **only the selected TAGGED surface**. It does not prove full PROFILE completeness and does not make historical receipts into live media. Do not download or reset archives merely to test diagnostics. Export **the TXT session log only**, no manifest required unless the new structured failure details are needed.

## Tests and publication policy

The CI includes inherited Story/PROFILE/REELS/media integrity suites, the two-source TAGGED helper/scanner suite, and a new historical path stability/authorization suite. The latter covers exact old native POST receipt reuse and all forbidden mismatched cases, with no fake OWNED roots.

**CI #455 PASS** after a distribution-metadata fixture correction; **CI #457 PASS** after ensuring authorization via currently complete TAGGED only. No real Firefox v1.5.111 acceptance as of this document; keep PR #25 in **DRAFT** and stable `main` v1.5.109 untouched until the next actual targeted log supports it. The earlier draft PR #24 is superseded.

Install TEST from:
`https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/fix/tagged-evidence-and-archive-v1.5.111/JKL_Instagram_Backup.user.js`

Keep only one enabled Tampermonkey script. Do not delete any download folder, reset ledger, or equate this experiment with an Instagram metadata correction.
