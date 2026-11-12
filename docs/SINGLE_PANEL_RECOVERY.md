# v1.5.100 TEST — reliable single-media action independent of Instagram's media overlay

## User reports and actual limitations

The user confirms that **the solo-download button has never worked**, although the complete profile backup had **780/780 successful GM_download callbacks** for `@petit._tigre`. Their age-warning Reel `https://www.instagram.com/petit._tigre/reel/DSzg-mICLxk/` displays the **same Instagram “Voir le Reel” warning** with both canonical and account-prefixed URLs. The Reel is already saved by the bulk archive and is **not** one of the two missing PROFILE roots. A URL regex fix in v1.5.99 alone cannot fix the media-overlay problem.

### Concrete weakness of v1.5.99

`refreshCurrentDownloadButton()` removed the floating `#jkl-current-download` whenever `largestCurrentMedia(root)` found no sufficiently sized visible IMG/VIDEO or `currentMediaOverlayHost()` rejected the DOM container. This was not accompanied by diagnostic logging; a React/Instagram interstitial can cover or replace the visible media entirely, making the floating button disappear despite a correctly decoded permalink. The `MutationObserver` watched child insertion/removal but not pushState URL changes that occur without a DOM mutation. Grid button injection also requires anchors enclosing IMG/VIDEO, which is not guaranteed by every Instagram layout. We have not established from an actual Firefox DOM capture that the age-warning interstitial is the user's sole root cause, or that the previously visible solo buttons failed only at UI placement.

### v1.5.100 fix

1. A **persistent, separate** `DOWNLOAD OPEN MEDIA (SOLO)` action is added to the main panel with a text readout of the selected username, route, shortcode or numeric ID. `updateSingleDownloadPanel()` gets the current direct URL/dialog target and **does not inspect the media's IMG/VIDEO DOM at all**. When no unambiguous media is opened, the button is disabled; it is also disabled during scans/downloads and any session API safety breaker.
2. Only an actual user click on this action calls `handlePanelSingleDownload()`, which logs the selected ID and calls the already audited `downloadSingleTarget(target, button)`. The existing `fetchStandaloneMediaInfo`, numeric identity validation, complete-carousel checks, `GM_download` writing, operation mutex, error status and safety stops are preserved. No automatic requests, downloads or age-flag bypass.
3. The floating overlay remains as before when a compatible media DOM host exists. If absent, a **rate-limited one-time per target/reason log** states `no_visible_media (possible interstitial)` or `no_compatible_media_host`, points to the independent panel button, and does not flood the 50k-line session archive.
4. In addition to existing DOM changes, `hashchange` and a 1s URL-only local check refresh the current target for Instagram SPA pushState navigation. This performs **no network requests**.
5. The main backup pipeline, 780 previous downloads, PROFILE `115/117` proof guard, independent REELS discovery and file layout are unchanged. Production `main` is untouched, PR #18 remains DRAFT. Parent-folder feature remains deferred.

### Automated tests

`tests/single-panel-action-regression.test.mjs` invokes the actual `updateSingleDownloadPanel()`, `handlePanelSingleDownload()` and `downloadSingleTarget()` functions in an isolated runtime with a fake opened target (the exact user-provided `DSzg-mICLxk` PK `3797523949836352612`) and mocked media-info / disk writer. It exercises:
- Age-overlay case with **no visible IMG or VIDEO**: persistent panel button enabled, correct username/shortcode readout.
- One actual handler call reaches authenticated media-info and the existing single-download controller with exact numeric ID, logs requested action and completion, holds/releases the mutex, and reports one success.
- Active scan and API safety stop disable panel action. No media on profile grid disables button; accidental programmatic calls do not issue media-info requests.
- Missing floating overlay emits a single diagnostic per target/reason, avoiding MutationObserver log recursion.
- Production HTML click wire-up and URL-only navigation refresh present.

Existing regression suite also exercised all download/scan coverage checks. [GitHub Actions #42942816343 SUCCESS](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/42942816343), code/test commit `717473effcef457eb17a46d4ba81821d756ae4b1`. Recheck final branch head after documenting.

### Real Firefox acceptance

Install the TEST branch v1.5.100 and open an ordinary POST/REEL with a visible direct permalink. Before touching download, verify the panel label contains the expected `POST / REEL`, shortcode and ID. **Do not use the already archived restricted Reel as a download test**; it is useful only to check target detection with the Instagram warning still in place.

To test the actual transfer, choose one authorized media not previously saved or accept one intentional repeat for a known file, click `DOWNLOAD OPEN MEDIA (SOLO)` **once**, then export session LOGS (.TXT) to observe `Single download panel click`, `Single download requested`, `Single download ... file(s)` or an explicit `Single download failed`. No full scan or download of the 780 existing files is needed. The browser-level click and real Instagram media-info response have not yet been validated by this CI alone.
