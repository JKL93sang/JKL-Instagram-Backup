# v1.5.107 TEST — SOLO floating button on username-only Story viewer

**Date:** 2026-11-13, Europe/Paris. **Status:** open draft PR #19, not merged into `main` (stable v1.5.105). Browser acceptance pending.

## Confirmed Firefox issue and root cause

The user's exact real address bar URL while looking at the Story was:

```text
https://www.instagram.com/stories/b_kkaaa/
```

The v1.5.106 parser `storyPermalinkInfo()` required `/stories/<username>/<numeric media ID>/`, so `currentSingleDownloadTarget()` was `null` and `refreshCurrentDownloadButton()` removed/never inserted the floating control. The simulated v1.5.106 regression used a synthetic numeric-ID URL; it could not catch this mismatch. The user reported no button on the actual page.

## Implementation

- Added strict `storyViewerRouteInfo()` recognizing **exact** `/stories/<username>/` without inventing a Story media ID. This target is `kind='story-viewer'`, `route='story'`, `mediaId=''`, with a per-username key.
- `singleDownloadTargetFromUrl()`, `storyFloatingAnchor()`, `refreshCurrentDownloadButton()` and the panel now handle the real viewer route, placing a body-fixed button near the Story, including if the Story shell has no recognizable `IMG/VIDEO`. Existing numeric Story permalinks and POST/REEL handling remain intact.
- `singleDownloadTargetFromButton()` admits the account-scoped viewer target only on the matching active route; stale viewer clicks are rejected rather than substituted with an unrelated media target.
- The **user's click**, not DOM mutation or page load, invokes `resolveStoryViewerItem()`. It confirms the account by existing profile metadata if needed and requests the existing authenticated same-account Story Reel query once. It checks all item IDs.
- For a response with **one Story item**, the sole server-authenticated item is selected. For **multiple Story items**, an exact path of the centered visible media's HTTPS Instagram/CDN resource must uniquely match a server-provided candidate URL. Missing/ambiguous/multiple matches stop without downloading.
- For the selected verified Story ID, reuse the normal authenticated media-info and existing `standaloneUnits`/GM_download path. The account URL and visible media (when multiple Stories exist) are checked again after asynchronous media-info, before any download.
- No automatic network probes, fabricated IDs, access bypass, full-profile scan, HIGHLIGHT ID guessing, unlimited retries, new global-download exception or false coverage.
- PROFILE and TAGGED incomplete guards remain unchanged: @b_kkaaa 110/122 main PROFILE, 76/77 TAGGED, 826 media records, partial eligibility 635 on the latest prior scan.

## Regression and CI proof

- Added `tests/story-username-viewer-regression.test.mjs`: exercises actual production functions against exact Firefox URL, UI mounting without image, account mismatch, highlight exclusion, stale click prevention, one Story, multiple Stories, ambiguous refusal, and guarded click through existing normal downloader.
- Retained existing direct-ID Story tests; updated isolated harnesses to include the newly required parser and updated version assertions without changing the inherited TEST branch URL.
- **Full GitHub Actions Userscript CI #43348437511: SUCCESS** for commit `7aec4aa7abeb5f4de4dc7604ae11bd7083d5ae7a`.
- The active code version is **v1.5.107** although the inherited work-in-progress branch remains named `fix/private-profile-story-solo-v1.5.106`. Both `@updateURL` and `@downloadURL` point to this live TEST branch, not `main`.
- **Real Firefox button appearance and actual media download have NOT yet been user-verified** on v1.5.107. Synthetic and repository CI success must not be confused with live Instagram acceptance.

## Minimal next test

Install the updated TEST userscript from `https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/fix/private-profile-story-solo-v1.5.106/JKL_Instagram_Backup.user.js`, leave **only one JKL Instagram Backup version enabled**, refresh Instagram, then open `https://www.instagram.com/stories/b_kkaaa/`.

1. Confirm a floating SOLO button is visible next to the Story. **No full SCAN, manifest, bulk download or archival reset required.**
2. If visible, optionally click once and check the confirmation/precise failure message. For multiple currently active Stories, an ambiguous visible asset must fail closed.
3. If absent, obtain the actual page view screenshot and exported same-session logs. Do not claim completion or merge until a successful live result.
