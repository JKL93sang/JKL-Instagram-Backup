# JKL Instagram Backup — single-media download reliability

## 2026-11-11 — v1.5.95 TEST (PR #18, draft)

### Scope and evidence
The user previously reported that the media-local **single download** button did not work for opened media or stories. The newly audited v1.5.94 source has a browser capture-phase click handler, direct permalink→media-ID resolution, authenticated `/media/<pk>/info/` lookup, file URL extraction and a `GM_download` transfer path. Existing regression tests checked mostly implementation presence and basic permalink conversion; **there has not yet been a reproducible user Firefox click failure log with the button’s status and network response**. We must not claim the historic button defect is resolved solely from offline tests.

### Concrete bugs fixed
1. **Silent partial carousel export:** `standaloneUnits()` skipped children whose download URL was unavailable, and still returned the available siblings as a “successful” download. A carousel could be reported as finished with only some units saved. The updated all-or-nothing planner validates complete child identities, no duplicates, explicit carousel count when supplied, no unfinished child pagination and a usable file URL for **every** child **before starting any file write**.
2. **Missing root identity binding:** the previous standalone path did not check that `media-info.items[0]` corresponded to the user-selected numeric media ID. The planner now receives the exact ID from the selected URL/button and rejects any mismatched, missing or invalid returned root instead of writing unrelated files.
3. **Concurrent operations:** per-button busy state prevented duplicate clicks on the same media, but did not prevent a second single download or a full scan/batch download while one was running. The single-media controller now participates in the existing global `state.downloading` mutex; success, error and validation-failure paths release it in `finally`. No new Instagram requests or retries were added.

### Executable regression coverage
New `tests/single-download-execution-regression.test.mjs` invokes real `standaloneUnits`, `downloadSingleTarget`, `downloadStandaloneAttempt` and the click-capture handler (with fake media-info, `GM_download`, event and DOM state; **no Instagram network requests**). It verifies:
- Accepted POST / carousel of three exact children yields three queued file writes and a success status.
- Wrong root ID, missing/duplicate child ID, a URL gap, unfinished sidecar or contradictory declared carousel count fail **before any partial transfer**.
- Actual `GM_download` builder receives the expected archive-relative path and callbacks.
- A click dispatches the bound numeric media ID with propagation intentionally blocked.
- The common operation mutex is held for individual downloads and released after both success and failure; bulk/other single requests cannot overlap.
- Existing source, UI, scan, HIDDEN, REELS, TAGGED and pagination guards continue to run unchanged in CI.

[Userscript CI SUCCESS #42926732319](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/42926732319) at tested commit `410137a35c19c0e8be642cb37477990804440327`. Final branch HEAD should be rechecked after documentation-only commits.

### Current limitations / Firefox acceptance
- The actual **button-in-Firefox** problem has not yet been proven corrected. It needs one ordinary user click on a legitimate opened POST or REEL, with the resulting `Single download requested / Single download / Single download failed` log, if observed. Do not flood Instagram with retries.
- This change does **not** affect `scanAll()` / 203 eligible ACCESSIBLE PARTIAL media from @aphrodixiaa v1.5.94. PRO­FILE native server-end remains missing; no fake completeness.
- The separate local archive indexing / parent-folder idea remains deferred. No forced SCAN LOCAL FOLDER for a brand-new profile.
- Production `main` stays v1.5.78, PR #18 stays DRAFT. Do not merge before acceptance and wider tests.
