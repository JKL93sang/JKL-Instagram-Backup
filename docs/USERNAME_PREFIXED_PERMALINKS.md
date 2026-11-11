# v1.5.99 TEST — username-prefixed Instagram permalinks (verified real user example)

## User evidence (2026-11-11)

The user provided both a real age-warned Reel URL and full v1.5.98 logs, plus the JSON manifest.

- Reel URL: `https://www.instagram.com/petit._tigre/reel/DSzg-mICLxk/`.
- Numeric shortcode-decoded Instagram PK: `3797523949836352612`.
- The Reel is present in **authenticated PROFILE native**, **mainGridSnapshot** and the **361-root REELS tab**, but absent from the 89-root anonymous PUBLIC timeline.
- Manifest record identifies a 2025-12-28 MP4 with sources `PROFILE_GRID_NATIVE`, `OWNED_DEEP_HYDRATION`, and a ledger `downloadedAt=2026-11-11T00:41:32.651Z`. Its prior backup is reported successful; this Reel **is not one of the two missing 115/117 PROFILE roots**.
- The TXT exporter is functional, recording all **77** log lines, zero lost; 174.34s scan: 89 PUBLIC (server-ended), 115/117 main, 361 independently ended REELS, 424/424 hydrated (19 bulk requests), 780 eligible. Cross-surface union remains **115/117** despite source diagnostics showing raw `nativeServerEnded=true`: that flag only describes the final observed native `page_info.has_next_page=false`, not a proven complete authenticated PROFILE feed. Final `PROFILE=false` is correct.

## Concrete code defect identified in v1.5.98

`mediaPermalinkInfo()` accepted only `/^\/(p|reel|tv)\/...` URLs, not Instagram's actual `/<username>/reel/<shortcode>/` form. The supplied link therefore **returned null**, impacting:
- `singleDownloadTargetFromUrl()` and `currentSingleDownloadTarget()`: direct opened-media single-download overlays might fail to identify the active media on an account-prefixed route.
- `profileLinks()` DOM candidate gathering: account-prefixed Reel/Post anchors were rejected even when present; this is a **possible** explanation for `domCandidates=0`, but the user's log does not provide raw DOM anchors, so it is **not proven to be the only cause**.

## Narrow fix in v1.5.99 TEST

- Accept **exactly** canonical `/p/<shortcode>/`, `/reel/<shortcode>/`, `/tv/<shortcode>/` and the user-prefixed variants `/<username>/p|reel|tv/<shortcode>/`. Disallow unrelated nested paths, extra segments and tab routes, preserving original shortcode canonicalization and numeric PK verification. Query parameters remain allowed without affecting the path.
- Populate `username` only when the route explicitly includes a username. When `profileLinks()` encounters a prefixed URL for a different profile, skip it instead of treating it as a candidate for the account being scanned; legacy canonical anchors still work and are checked at hydration.
- The same fix allows the existing single-download controller to resolve the user's real URL without changing media-info APIs, bulk behavior, coverage, pagination, rate-limit guards, storage paths or manifest schema.
- New executable offline `tests/profile-prefixed-permalink-regression.test.mjs` exercises **actual** `mediaPermalinkInfo`, `singleDownloadTargetFromUrl` and `profileLinks` against `DSzg-mICLxk`, canonical/noncanonical variants, cross-profile rejection and malformed paths. No Instagram network operations are made. CI runs existing scan/download regressions too.

## Acceptance and limitations

This fixes a real **URL recognition** defect, but must not be represented as proven recovery of the 2 unknown roots or as a guarantee that all single download overlays work with Instagram's rendered DOM. Browser acceptance requires testing a media opened at the prefixed path, observing the button and its `Single download requested` / success log. Do **not** re-download the prior 780 merely to test the parser.

Experimental branch PR #18 stays DRAFT and production `main` v1.5.78 stays unchanged. The parent-folder idea remains deferred. GitHub CI status/link should be updated after final documentation commit.
