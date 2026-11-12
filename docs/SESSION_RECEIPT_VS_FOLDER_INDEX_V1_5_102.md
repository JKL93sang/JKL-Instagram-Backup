# v1.5.102 TEST — separate GM_download session receipts from the real folder index

## Proven bug

In v1.5.101, `downloadMainOne()` treated a successful `GM_download.onload` callback as though `SCAN LOCAL FOLDER` had independently indexed the destination file. It inserted the ID into `state.diskCanonical`, `state.diskLocations` and `state.diskCanonicalMeta`, although Firefox may have saved into a different directory, a renamed path or the user's default Download folder.

That polluted the local archive's **IDs** counter and could make `diskSatisfiesOwnedRoot()` believe an item was disk-backed without an actual file being found. In short: a successful transfer callback is not a local file inventory or a byte-level integrity check.

## Changes in the TEST branch (no new Instagram requests)

- `state.diskCanonical`, `state.diskCanonicalMeta`, `state.diskLocations` and `state.diskPaths` are now modified only by the *folder indexing* path, never by a new `GM_download.onload`.
- New `state.sessionCategories: Map<mediaId, Set<archiveCategory>>` captures only session-level accepted callbacks; existing `state.sessionPaths` keeps the requested save paths, including per-HIGHLIGHT reel folder.
- `existingReason()` returns `DISK` when an indexed file matches the category/valid HIGHLIGHT folder; `SESSION` for accepted callback receipts in the current indexing epoch; `LEGACY` for older filename matches; otherwise `null`.
- The special HIGHLIGHT reel-folder test remains mandatory to avoid mixing different highlights under a shared numeric media ID.
- Reindexing a local directory clears session receipts and reconstructs disk evidence solely from selected `File` entries. A file absent from that fresh index is no longer treated as a verified archive item, even if a prior callback had reported success.
- The ARCHIVE UI displays **Indexed matches**, **Session callbacks** and **Legacy matches** separately, alongside existing queue Existing/Missing and folder inventory counts.
- Batch completion reports `GM_download success callbacks (disk not independently verified)` rather than physical writes verified. The zero-pending message lists actual indexed matches, session callbacks and legacy matches instead of declaring a whole archive physically verified.

## Real user evidence and boundaries

- Prior live v1.5.98 @petit._tigre backup: 780/780 `GM_download` callbacks succeeded. **This is not equivalent to disk verification.** The main PROFILE scan remained **115/117 INCOMPLETE** and must remain so; the new change cannot fabricate missing roots.
- v1.5.101 SOLO acceptance succeeded in real browser on a plain POST, carousel, ordinary accessible REEL and accessible STORY. The SOLO media-transfer controller is unchanged by this fix.
- No forced scan, re-download, deletion, rewrite of existing archive files, Instagram API workaround or promotion to `main` is performed.
- `SCAN LOCAL FOLDER` indexes file names, paths and categories. It does not hash or open file contents. An indexed filename is stronger evidence than a callback but is **not** a full disk integrity audit. A session receipt should not be presented as a disk-certified file.
- Older ledger `downloadedAt` entries remain historical callback records. They cannot retroactively prove physical file presence.

## Tests

- `tests/session-receipts-vs-disk-index-regression.test.mjs`: real production `existingReason`, `indexFolder`, `downloadMainOne` and `diskSatisfiesOwnedRoot`. Synthetic folder with one indexed file; accept another GM callback; verify folder counts/meta do not change; exact category isolation, HIGHLIGHT identity; reindex without the accepted file (it becomes missing); reindex with it (becomes DISK).
- `tests/batch-download-failure-retry-regression.test.mjs`: 129 jobs, 128 session receipts and 1 permanent `not_succeeded`; no claimed disk-index expansion; failed file retained for one targeted retry, no duplicate 128 callbacks.
- `tests/local-archive-index-display-regression.test.mjs`: UI must display distinct Indexed matches / Session callbacks / Legacy matches.
- Full GitHub Actions suite required before declaring the branch CI green.

## Release gate

Version is **v1.5.102 TEST** on PR #18, with source/update/download URLs still pointing to the **TEST branch**. `main` remains stable v1.5.78 until browser validation of the changed local-index semantics and a deliberate release decision; a successful synthetic test alone is insufficient.

### Targeted browser acceptance (only when possible)

1. After selecting an existing folder, note ARCHIVE Files/IDs and Indexed matches.
2. Download one genuinely missing, authorized media. Expect Session callbacks +1, but folder Files/IDs unchanged until the next folder re-index.
3. Re-select the folder actually containing the new file. Only now should Indexed matches/IDs increase, provided the path is correctly recognized. Do not re-download existing 780 files or scan Instagram just to check these counts.
