# JKL Instagram Backup — Stable release v1.5.105 (12 November 2026)

## Distribution and compatibility

Official Tampermonkey URL:
https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/main/JKL_Instagram_Backup.user.js

This release retains `@name=JKL Instagram Backup` and `@namespace=https://jkl.local/`. `@source`, `@updateURL` and `@downloadURL` all target `main`. The change from TEST v1.5.104 to stable **v1.5.105** is deliberate: versioned automatic update checks should not treat the installed experimental build as equal to the stable build. Disable any duplicate TEST installation; retain one active userscript.

## Changes included since stable v1.5.78

- PROFILE PUBLIC and authenticated/native evidence with strict server-end and account checks; source-specific provenance is included in the manifest. No guessed GraphQL cursor, invented post, or synthetic native completion.
- Safe **composite PROFILE completion** for the specific case where real public/native timelines both end but the official counter exceeds their union. Additional main POST identities must each be present in the authentic main snapshot, observed on that profile's DOM, confirmed by server-returned per-ID media-info as the same owner, exact media ID and shortcode, and fully resolved through all child media. An untrusted DOM link alone is never sufficient. The partial/virtualized DOM need not include older items already proven by PUBLIC/native.
- Independent REELS page-info completion, protection against a missing REELS tab being mistaken for zero clips, safe separately verified partial-download grants if the profile is incomplete.
- SOLO single-media controls for POST, carousel, accessible REEL and STORY, with verified child identity. Preserve normal named archive categories; do not bypass private content or age gates.
- Local file index rebuilt only from actual selected folder names and paths. `GM_download.onload` produces a **session success callback**, not a claim of disk presence. `Indexed matches`, `Session callbacks` and `Legacy matches` are distinct diagnostic concepts; SOLO does not retroactively populate the batch ledger.
- Distinct category routing: POSTS, REELS, HIDDEN, FAN CLUB, TAGGED, HIGHLIGHTS with ID-specific folder names, STORY, AVATAR. Logs display last 2,000 lines and can export a much larger session history. Scrollable interface and progress information.

## Browser acceptance evidence

Actual user-provided Firefox v1.5.104 logs and JSON manifest dated 2026-11-12 23:39 local for `@petit._tigre`, fully checked:

- Official profile counter 117, main snapshot 117 roots: 65 POST and 52 main REEL.
- PUBLIC server-ended with 89 root IDs; authenticated native capture server-ended with 93, sharing 67. Genuine PUBLIC/native union = 115.
- The two additional POST parent roots 3153889526261377396 and 3285109440665201171 were observed in the main profile and individually corroborated by exact-owner, exact-shortcode media-info; their child files numbered 3 and 6 respectively.
- Explicit proof log `public_native_dom_api_exact_counter_proof` computes the combined 117 identities without falsely claiming 117 paginated roots.
- Independent REELS tab 361 root IDs, 309 not part of main PROFILE; OWNED hydration 426/426. 789 media units in the manifest: POSTS 229, REELS 361, HIGHLIGHTS 192, TAGGED 6, AVATAR 1.
- All nine selected source-coverage guards TRUE; `SCAN FINISHED — COMPLETE`. Source and queue fingerprints agree with the preceding incomplete scan.
- User separately reported that both additional carousels downloaded via SOLO and local file index rose from 780 to 789. The manifest's 780 historical **batch** receipts are deliberately not increased by SOLO; this is not a physical-missing-file indicator.

The automated test suite additionally covers unsafe and incomplete scenarios (missing native/public end, mismatched identity or owner, partial carousel, wrong category, unrelated REELS, incomplete folder indexing), plus the specific 117-main/108-DOM/115-public-native scenario that failed in v1.5.103. All regression tests passed at the final stable candidate branch before merging.

## Known limits / nonclaims

1. **Batch callback/index user acceptance still outstanding.** The v1.5.102 distinction between callbacks, selected-folder index and prior ledger has synthetic/integration test coverage but has **not yet been observed on a new legitimate small batch `DOWNLOAD MISSING` operation** in the user's Firefox. Do not manufacture a download or re-download existing 789 media just to test it. Document this separately if a future real batch behaves unexpectedly.
2. `SCAN FINISHED — COMPLETE` refers to the *currently selected authorized source surfaces*, official counter and available network evidence. It is not a cryptographic integrity check of local bytes, or proof of any inaccessible/hidden material outside the account's authorization.
3. Direct SOLO downloading uses browser `GM_download`; Firefox's actual destination/overwrite behavior remains in the user's control. Selecting the intended folder with `SCAN LOCAL FOLDER` is the way to observe local indexed names.
4. Instagram request schemas and page behavior can change. Fail closed rather than inventing completeness, and use the exported TXT logs before requesting a large manifest.

## Release review and evidence

- [PR #18](https://github.com/JKL93sang/JKL-Instagram-Backup/pull/18) consolidates test history, code, the extended CI suite, and technical reports.
- [Live 108-DOM proof and regression](PROFILE_DOM_VIRTUALIZATION_108_VS_117_V1_5_104.md)
- [Strict hybrid proof design](PROFILE_HYBRID_DOM_API_PROOF_V1_5_103.md)
- [Disk index vs session callback semantics](SESSION_RECEIPT_VS_FOLDER_INDEX_V1_5_102.md)
- [Two missing root IDs and nine child files](PROFILE_DOM_TWO_ROOTS_NINE_FILES_2026_11_12.md)

The stable release changes the version and distribution metadata, **not** the behavior proven in v1.5.104 Firefox. The one browser-unverified batch UI subfeature is documented transparently rather than silently marketed as fully field-tested.
