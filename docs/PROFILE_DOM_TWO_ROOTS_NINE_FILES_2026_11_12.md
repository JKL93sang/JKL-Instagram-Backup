# @petit._tigre — 2026-11-12 v1.5.102 diagnostic: 117 observed, 115 proven, 9 new media units

This report is **derived from the user's original files**, read without contacting Instagram:

- `petit._tigre - Instagram Backup Logs - 2026-11-12_04-56-44.txt` (78 saved log entries, 0 lines lost, 1.5.102).
- `petit._tigre - Instagram Backup Manifest(1).json` (created 2026-11-12 03:56:33Z, 789 record IDs and 780 ledger IDs).

## Folder inventory and scan

- `SCAN LOCAL FOLDER`: **780 filesystem file names selected; 780 canonical IDs, no HIDDEN, no legacy** (04:52:47). This *is a folder inventory*, not a byte/hash integrity audit.
- `media_count` = **117**. Main PROFILE snapshot = **117** distinct parent roots (65 POST, 52 REEL), including 2 observed only through DOM. **Coverage remains PROFILE=false / INCOMPLETE** because the public/native union is only **115**.
- Verified PUBLIC = 89 roots, server-end reached; native observer = 93 roots, with 67 shared; union = 115. DOM candidates = 117; exactly 2 outside public/native. Independent native REELS = 361, of which 52 are in main and 309 are independent, not proof of main PROFILE completeness.
- OWNED = 426 roots, hydration 426/426 (361 disk-satisfied); TAGGED=6, HIGHLIGHTS unique=192, AVATAR=1, no current STORY. Total queue = **789 media units**. Final status `SCAN FINISHED — INCOMPLETE`, not `COMPLETE`; separately authorized partial subset contains 417 media.

## Exact 2 main parents identified by DOM, not by the public/native union

| Parent ID decoded from shortcode | Instagram permalink | Date in manifest | Child photo IDs in current records not present in current ledger |
|---|---|---|---|
| `3153889526261377396` | https://www.instagram.com/p/CvE3dBpoml0/ | 2023-07-24 | `3153889516052320990`, `3153889516060724304`, `3153889516060803645` |
| `3285109440665201171` | https://www.instagram.com/p/C2XDaGLIaoT/ | 2024-01-21 | `3285109433341867188`, `3285109433350231767`, `3285109433350297195`, `3285109433350393861`, `3285109433350484309`, `3285109433358742864` |

The parent IDs are **not themselves child-file record IDs**. They are deterministically decoded from their shortcodes; each child record has `type=POST`, `archiveCategory=POSTS`, `sources=[PROFILE_GRID_DOM]`. All nine children have validated filenames and paths in the manifest; they were hydrated via individually targeted media-info in the user's existing scan. Do **not** reclassify these roots as PUBLIC or verified native-pagination roots.

## Exact set comparison

- `records` (scan) = 789 media IDs.
- `ledger` (historical accepted-download callbacks) = 780 media IDs.
- `records minus ledger` = **exactly the above 9 photo IDs**.
- `ledger minus records` = 0.
- Across both sets, all other categories match one-for-one: REELS 361, HIGHLIGHTS 192, TAGGED 6 and AVATAR 1. POST photo units are **229** in records versus **220** in ledger.
- The 780 indexed local IDs match the *count* of ledger entries, but the exported manifest does **not contain the per-file folder-index list**. Therefore the nine unledgered IDs are *very likely* absent from the selected folder, but direct physical absence/presence has **not been independently established**. Avoid claiming that the filename inventory definitely matches the ledger record-for-record.

## Safe, finite recovery using existing v1.5.102 SOLO — no mass scan

- The already user-validated SOLO carousel handler opens the **exact media permalink**, checks the server media-info root ID and all children, then downloads the whole carousel with `GM_download` to the ordinary `POSTS` filename layout. It refuses a partial carousel if children are missing.
- Only when the user wishes to recover these **2 exact posts**: open the two links in Instagram (while normally authorized) and use **SOLO**. Expect three then six photos, provided the server still exposes the media. This fetches only those two identified root IDs; do not press `DOWNLOAD MISSING` on the full incomplete grid and do not re-download the 780 historical media.
- After SOLO, re-select the *actual destination* archive folder and verify that the nine exact filenames appear in `SCAN LOCAL FOLDER`, ideally **789 canonical IDs**, assuming no other files changed. No need to repeat the long 159-second Instagram scan just to prove the new file presence.
- SOLO uses `downloadStandaloneFile()`, which does **not** add session callbacks to `state.sessionCategories` or append to the batch persistent ledger. It can therefore increase the **folder inventory after re-index** while `ledger` remains at 780. Do not interpret that ledger difference alone as missing physical files after SOLO.
- **Important:** `GM_download` in SOLO uses `conflictAction:'overwrite'`; if one of these child files does already exist at the chosen destination it may be overwritten. The user can first check those exact filenames locally or select an isolated destination if no overwrite is desired.

## What is not solved

The exact missing **IDs** are now known as DOM observations, but **PROFILE completion proof** remains unavailable: public/native union=115/117 and the independent native page-end/counter proof is not sufficient. `INCOMPLETE` is the correct status. A new test in `tests/profile-cross-surface-proof-regression.test.mjs` reproduces 89/93/67/115, 117 DOM observed, 65 POST/52 main REEL, 361 independent, 426 owned and 9 resolved-but-unledgered children, affirming the scanner MUST stay incomplete.

The v1.5.102 local **callback-versus-index** patch already passed CI before this test-only follow-up, but cannot be fully user-accepted from these exports alone: there was no new authorized `DOWNLOAD MISSING` batch callback. This report does not certify disk byte integrity, any bypass, or full-account completion.

PR #18 remains DRAFT; stable `main` remains untouched.
