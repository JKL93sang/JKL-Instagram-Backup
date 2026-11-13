# v1.5.108 TEST — private PROFILE viewport sweep and strict TAGGED carousel union

**Date:** 2026-11-13 Europe/Paris
**Branch:** `fix/profile-tagged-coverage-v1.5.108`
**PR:** [#20 DRAFT](https://github.com/JKL93sang/JKL-Instagram-Backup/pull/20), based on the already Firefox-proven [v1.5.107 Story SOLO TEST branch (PR #19)](https://github.com/JKL93sang/JKL-Instagram-Backup/pull/19).
**Stable main:** v1.5.105, untouched.
**Verification:** [Userscript CI #43351498212 — SUCCESS](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/43351498212) for code/test HEAD `b3e509bc2ddeb790c443b588496f652b42400764`.

## Ground truth from user files, not inference

The user-supplied `b_kkaaa - Instagram Backup Logs - 2026-11-13_01-23-08.txt` has all 87 lines, zero dropped, and matching `b_kkaaa - Instagram Backup Manifest(1).json` has 826 current media records and 836 historical ledger entries.

| Surface / proof | Actual v1.5.106 Firefox result |
| --- | --- |
| Target | `@b_kkaaa`, authenticated `45374661889`, `is_private=YES` |
| Instagram declared PROFILE count | 122 |
| Main PROFILE fully accepted | 110 (104 POST + 6 REEL) |
| Native authenticated PROFILE root IDs | 61 (audit `initial=0`, `continuation=6`, `cursor_schema=root`, `last_has_next=false`) |
| DOM PROFILE observed | 106 IDs; 105 intersect accepted main, one candidate `3235327106903901019` / `CzmMNy7MwNb` failed `incomplete_media_units` |
| Independent REELS | 7, with 6 overlapping main and 1 outside |
| Main PROFILE counter gap | **12**; additional independent REEL does not close this gap |
| TAGGED | Seven proper server-ended pages, 77 root IDs, 76 full, **one `carousel_item_count_gap`** after `web_media_info_attempted` |
| HIGHLIGHTS / STORY / AVATAR | 11 albums / 566 media; 1 current Story; 1 Avatar |
| Current queue vs historic ledger | 826 vs 836; differing sets are expected, no deletion warranted |
| Partial eligible | 635, not total archive proof |
| Final coverage | `PROFILE=false, TAGGED=false`, `SCAN FINISHED — INCOMPLETE` |

The remaining 12 PROFILE identities **cannot be reconstructed from the official counter**. A native last-page flag alone is insufficient without a verified initial request. The current manifest does not contain the raw two TAGGED media response fragments for the unresolved carousel; therefore it is **not known** whether they are complementary. The code change tests the possibility, not a guaranteed recovery.

## Implementation and safety

1. `sweepProfileDomViewport(seenDom,target)` runs **only for a private account**, on the already-open correct PROFILE route, when the official count exceeds the union of native roots and previously seen DOM candidates. It visits up to **120** bounded intermediate viewport positions at **160ms** each, preserves observed candidate links, and confirms visual bottom only as a **visual** event. No fabricated/guessed Instagram GraphQL requests; aborts on cancellation, route change and all active safety breakers. Existing same-owner / same-root / same-shortcode / all-carousel-unit media-info validation remains required before accepting a DOM candidate. It does not assert completeness by counter.
2. `verifiedTaggedCarouselUnion(listing,detailed)` can combine two authentic, matching-parent carousels from the already used TAGGED GraphQL edge and one bounded same-origin authenticated media-info GET. Preconditions: same numeric root ID, both server-declared carousels, no unfinished sidecar pagination, compatible safe integer counts, individually valid/distinct child IDs, no contradictory explicit image/video type, and **exactly** the declared number of unique child IDs across the union. The synthetic in-memory composite contains **only actually returned child records**, not invented IDs or guessed download URLs. Existing `addMedia(...,'TAGGED','TAGGED')` and `discoveredMediaResolution` must still verify each child ID, file, root relationship and TAGGED source. If anything is missing, `TAGGED=false` is preserved. New logs expose only parent ID and count diagnostics, no URLs/credentials.
3. The earlier verified v1.5.107 Story viewer parser, visible floating button, click-time authenticated Story selection, normal media-info and SOLO download path remain unchanged. HIDDEN exclusive, FAN CLUB, local disk/ledger and download protections are unchanged.

## Tests

New executable production-function test `tests/profile-tagged-coverage-v1-5-108.test.mjs`: DOM virtualization samples from multiple viewport positions; no direct API; strict profile route and cancel guard; TAGGED exact union 2+2→3, fail-closed identity, count mismatch, duplicate children, media kind contradiction, incomplete pagination; actual `discoveredMediaResolution` rejects a merged child lacking TAGGED provenance.

All previous 43 regression scripts remain in `.github/workflows/ci.yml`. Version and TEST update URLs point only to the new experimental branch. GitHub full CI is green at `b3e509bc2ddeb790c443b588496f652b42400764`. This is an automated check, **not** a live Instagram completeness claim.

## Next single live check

Install only `https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/fix/profile-tagged-coverage-v1.5.108/JKL_Instagram_Backup.user.js`, disable other JKL userscript variants, refresh the private profile, and perform **one** SCAN with the usual categories. **No local folder deletion or ledger reset, and no bulk download needed to test coverage**.

Export the TXT logs only. The diagnostic lines to compare with the previous test are:
- `PROFILE DOM viewport sweep: steps=..., candidates=...→..., new=..., end=...`
- `Main PROFILE grid: ... OWNED=.../122, ended=...`
- `PROFILE SOURCE AUDIT ... main_gap=...`
- `TAGGED carousel strict union not complete: root=..., list=..., info=..., union=..., declared=...` (if still unresolved)
- `TAGGED GraphQL complete: ... resolved=.../77, reasons=...`
- `coverage guards: PROFILE=..., TAGGED=...`

**Acceptance:** only an actually verified and internally consistent 122/122 main PROFILE / 77/77 TAGGED with valid server proofs may be reported as complete; a larger count alone is not sufficient. If the gap persists, leave it explicit and examine these exact new diagnostics before any further change. Do not merge PR #20 without real Firefox evidence.
