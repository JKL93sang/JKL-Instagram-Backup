# v1.5.97 TEST — full session log export, display cap and observed backup result

## Verified user-provided result (2026-11-11)

The real Firefox v1.5.96 `@petit._tigre` file supplied by the user contains exactly **300 non-empty log lines** (301 including the blank first line); the first visible message starts at **01:46:32** in the middle of REEL downloads, and the final message is **01:54:24**. Breakdown of visible lines: 286 individual REEL success callbacks, 13 ledger flush lines, one final operation summary.

The actual last-operation summary is:

```
[01:54:23] VERIFIED ACCESSIBLE PARTIAL finished: 780 media jobs processed, 780/780 physical writes succeeded, 0 failed, 0 blocked; 830.38 s, 1.06 s/job. Overall PROFILE scan remains INCOMPLETE.
[01:54:24] Ledger flush: 5 records persisted in 0.71 s.
```

Interpretation: Tampermonkey reported 780 successful file-write callbacks. These are not independently reopened/hashed file checks. **The 115/117 PROFILE main-grid gap remains unresolved**, but all 780 *identified* units were written without reported download failures. Earlier individual completion logs cannot be reconstructed from the supplied 300-line paste and are not evidence of a new download problem.

## Root cause and correction

v1.5.96 `APP.MAX_LOG=300`; `log()` appended each message into the DOM and deleted the oldest node in a loop when there were more than 300. **There was no independent session log store.** Copying the panel after a large run therefore lost the scan start, summary phases and first hundreds of downloads.

v1.5.97 TEST introduces:
1. **Display:** `MAX_LOG=2000` lines, still bounded to protect the Firefox panel.
2. **Independent chronological log archive:** `logArchive.entries` records every `log()` call, including boot messages before the log UI mounts; `MAX_LOG_ARCHIVE=50000` entries independent of visible DOM. At the cap, the oldest 1000 entries are removed in one batch to avoid repeated expensive shifts and `dropped` is counted and disclosed. Not persisted between page reloads or restarts.
3. **Button:** `LOGS → EXPORT LOGS (.TXT)` opens a local Blob download; it remains enabled while scans/downloads are busy. No Instagram request, no change to the download queue, scanning, pagination, authentication, account restrictions, ledger or media inventory.
4. **Filename:** `<username> - Instagram Backup Logs - YYYY-MM-DD_HH-mm-ss.txt`, based on the local browser clock at export; user IDs are normalized as usernames, no Windows-invalid filename punctuation.
5. **File content:** UTF-8 with BOM, CRLF line separators for Windows editors, all 50k retained lines (not the 2000 displayed lines). Header includes profile currently active, accounts encountered within the session, version, session-start/export times, retained and discarded counts, plus explicit warning if memory eviction happened. The downloaded artifact is the current browser page's history; it cannot backfill messages that v1.5.96 already discarded.

## Executable offline regression

`tests/log-session-export-regression.test.mjs` invokes the actual `log()`, `logExportFilename()`, `buildLogExport()`, and `exportLogs()` functions, using a mocked DOM and Blob URL and **zero Instagram calls**. It demonstrates a 2351-entry session with only 2000 DOM nodes, export preserving the first and last log entry and accented filenames/characters, correct filename date/time, correct UTF-8 BOM bytes and CRLF, callback execution, and audit-count/warning behavior when 50k-entry memory limit is reached. The CI also runs the complete existing scan and download regression suite.

[GitHub Actions #42936138098: SUCCESS](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/42936138098) at tested source/test commit `9050bd68e8c29d77deda97aa353a9057f1b9386c`. Recheck last HEAD after documentation commits.

## Production and acceptance boundaries

Only experimental branch `fix/public-ssr-reels-evidence-v1.5.79` / PR #18 DRAFT is modified. `main` stays v1.5.78. The v1.5.97 log feature requires an updated userscript and **a new active page session** to collect a complete log from its start; installing v1.5.97 does NOT recover the already-discarded v1.5.96 log lines. No additional scan/re-download is necessary *just to validate that the prior 780 downloads reported success*. If troubleshooting the 115/117 issue later, only a future user-initiated genuine scan after archiving the data can supply its early logs.

The Instagram age-gate “Voir le Reel” remains a useful unresolved diagnostic hypothesis; no bypass or claim that it explains the two PROFILE root gaps was introduced by this feature.
