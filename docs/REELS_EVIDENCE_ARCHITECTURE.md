# REELS evidence architecture and account-safety review

**Status:** experimental branch only; do not merge to production on the basis of this review alone. No Instagram account, session, browser automation, or private endpoint was contacted to produce this change. Tests use synthetic fixtures and GitHub Actions.

## Objective and non-negotiable invariants

The actual objective is a reliable **archive of all content legitimately exposed to the current viewer** without misrepresenting completeness. It is **not** to make the UI show a green `REELS=true`.

1. A complete REELS feed requires **verified, target-bound server pagination reaching an explicit end**, or a **target-bound explicit zero-clip signal** corroborated by independent sources. Missing keys, blank UI tabs and a matching post counter are not substitutes.
2. A Reels video can be shared to the **Reels tab but not the main profile grid**. Therefore `main_grid_count == media_count` cannot prove `reels_count == 0`. Meta's public explanations: https://about.fb.com/news/2020/08/introducing-instagram-reels/ and Meta's Instagram API collection `share_to_feed=false`: https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
3. Instagram Stories use the historical word "reel". `latest_reel_media` in user information is **Story timing**, not a positive short-video-Reels signal.
4. A private-mobile API called from a desktop Web session is **not** a verified Web contract. The earlier `POST /api/v1/clips/user/` did trigger `feedback_required` in a real Firefox scan; it is removed, and must not be reinstated or replaced by guessing another doc ID.
5. No source marked `UNVERIFIED`, `NOT_EXPOSED` or `UNKNOWN` can authorize a full-archive download. Explicitly verified, source-bound partial-media grants remain possible, with immutable IDs and fingerprints.
6. `feedback_required`, HTTP 429, HTTP 401 on authenticated endpoints, and explicit login/checkpoint/challenge signals stop further automated requests. After a stop, no queued `GM_xmlhttpRequest` may start. A single media-info HTTP 4xx is **not** a reason for 2 hosts × 3 retries.

## Passive REELS evidence state machine

| Selected? | Server proof | Native tab | Known clips | Other evidence | Verdict | Full backup |
|---|---|---|---|---|---|---|
| No | n/a | any | any | any | `NOT_SELECTED` | REELS not requested |
| Yes | Independently ended native pagination or proven explicit zero | any | any | validated | `PROVEN` | eligible if **every other selected source** is also proven |
| Yes | No | visible | any | no pagination end | `UNVERIFIED` | locked |
| Yes | No | absent | yes | positive count or root ID | `UNVERIFIED` | locked |
| Yes | No | absent | none | contradictory SSR metadata | `UNKNOWN` | locked |
| Yes | No | absent | none | public timeline, hidden-candidate and hydration surfaces independently verified; no exclusive feed | `NOT_EXPOSED` | **locked**; verified partial accessible archive only |
| Yes | No | absent | none | incomplete independent evidence | `UNKNOWN` | locked |

`NOT_EXPOSED` describes what the present browser UI exposes, **not** what may exist on Instagram. For the real one-public-post profile, the factual verdict is `NOT_EXPOSED` (not `EMPTY`), pending an independently verified clip count or native Reels connection. Retrying other transports cannot resolve this epistemic gap reliably.

## Request lifecycle and failure policy

- **Native Web capture:** browser-originated fetch/XHR only, scoped to the exact current profile and its actual `page_info`, variables and cursor contract; the userscript cannot synthesize end-of-pagination when the browser supplied none.
- **Script-initiated operations:** retain the already proven PROFILE, PUBLIC SHADOW, CONNECTED hidden, HIGHLIGHT, STORY, TAGGED and necessary media hydration paths. These calls are **not guaranteed safe** merely because they previously worked. The current script still uses authenticated REST and mobile-like user agents for some established media-info/profile calls; these remain an acknowledged residual risk.
- **No speculative REELS API call** on a profile without a tab. The script returns locally with a truthful `NOT_EXPOSED` / `UNKNOWN` verdict. No probing other users, no CAPTCHA/challenge bypass and no proxy/device rotation.
- **Circuit breakers:** every GM request checks existing stop flags *before dispatch*; native response hooks check 429, feedback and explicit challenge control fields; the Web JSON fetch checks HTTP401/challenge too. Positive control fields are matched narrowly so captions containing `login_required` cannot fake an auth error.
- **Media hydration:** 400/401/403/404/410/422 are not retried. 401/403 in an authenticated media-info call stop the scan. Other recoverable failures may still retry according to existing limits and are a residual review item.

## End-to-end acceptance matrix, all offline

1. Account with zero clips, target-verified explicit zero + independently completed public timeline + hydrated root + hidden candidates checked ⇒ `PROVEN` and full scan eligible.
2. Same account but clips metadata omitted (real-world shape) ⇒ `NOT_EXPOSED`, `coverage.reels=false`, `scanOutcome=INCOMPLETE`; verified accessible partial archive eligible if other source proofs passed. No REELS call.
3. Hidden-from-main-grid Reels or positive clip counter ⇒ `UNVERIFIED` until native Reels pagination ends; the public posts counter never overrides this.
4. Present Reels tab but no native server-end ⇒ `UNVERIFIED`, not a complete scan.
5. Conflicting / wrong-user / malformed metadata ⇒ `UNKNOWN`, never zero.
6. `feedback_required`, 429, HTTP401, checkpoint ⇒ immediate circuit, subsequent GM requests never dispatch; no user media is downloaded on an interrupted scan.
7. HTTP 400, 403 and 404 on media-info ⇒ one attempt, no domain rotation/retry cascade.
8. Non-Instagram text mentioning `login_required` in a caption ⇒ no false checkpoint classification.

**Automated suite:** `tests/reels-evidence-and-request-safety-regression.test.mjs`, plus the existing profile/SSR/native pagination/verified partial tests. GitHub Actions is a code-level validation only, **not** a browser acceptance test or a guarantee that Instagram will never restrict automated activity.

## Explicitly unresolved

There is no independently verified REELS source for the current absent-tab profile; neither the script nor this design can truthfully promise a 100% complete Reels archive from that evidence. Recovering a trustworthy source would require an official supported API for the relevant account permissions, or a genuine browser-originated native Reels response for this account. Do **not** create yet another guessed endpoint or ask the user for repeated live scans.

**Release policy:** the branch stays experimental; stable `main` is untouched until a genuinely new, non-speculative source and browser validation are available. The safe immediate capability is a truthful verified-accessible partial archive, not unverified full completeness.

## v1.5.84 — authenticated transport hardening (offline)

This pass intentionally **does not** change the Reels discovery contract. It removes avoidable risk from the rest of the script, rather than replacing one unsupported Reels endpoint with another.

- **Global GM dispatcher:** at most two outstanding `GM_xmlhttpRequest` calls from this script at once; additional requests wait in a FIFO queue. A fatal circuit is checked before every dispatch. Once `feedback_required`, HTTP 429, HTTP 401 or an explicit checkpoint is observed, pending requests are rejected locally. Requests already transmitted cannot be unsent; at most two GM requests can be in flight when a circuit opens.
- **Error callbacks:** the same circuit logic runs for response `onload` and `onerror`, including HTTP 429 received via `onerror`. An `onabort` settles the original promise and releases its dispatcher slot; duplicate callbacks settle only once.
- **Endpoint method restriction:** script-generated `POST`, `HEAD` or other non-`GET` requests to `https://www.instagram.com/api/v1/*` and `https://i.instagram.com/api/v1/*` are blocked **before network dispatch**. The current, separately vetted `POST https://www.instagram.com/api/graphql` used by anonymous PUBLIC pagination is unaffected. The rejected `clips/user/` POST cannot silently reappear under a new helper function.
- **Protocol-level detection:** `feedback_required` is recognized only from server control fields / explicit error tokens, not arbitrary media captions, which previously could trigger false-positive global shutdowns when string-matching the entire response. Checkpoint/login signals retain strict top-level/error-object parsing.
- **No hidden request retries:** established media-info 4xx no-retry rules remain. The scheduler doesn't add new retries, probes, or additional endpoints.
- **Regression tests:** `tests/reels-evidence-and-request-safety-regression.test.mjs` now exercises five concurrent GM requests with delayed callbacks (2 active / 3 queued), a server `feedback_required`, HTTP 429 via `onerror`, 401/checkpoint via `onerror`, ordinary captions containing the feedback token, blocked private REST POST to both hosts, and allowed Web GraphQL POST.

### What remains outside this safety guarantee

- Browser-native fetch/XHR and the script's own `fetchJson` transport are distinct from the GM dispatcher. This cap does **not** globally limit all browser-originated requests.
- Some existing authenticated media-info, user-info and FAN CLUB requests still impersonate mobile User-Agent strings. Their safety cannot be established with synthetic tests. They should be reviewed individually against observed, legitimate browser behavior before any further feature changes.
- Neither the new request scheduler nor a green GitHub Actions run demonstrates that Instagram will not impose restrictions.
- The absent-tab profile still has **unknown** REELS completeness. This pass makes no claim of exhaustive recovery and requires no new Instagram test from the user.


## v1.5.85 — all selected surfaces must reconcile to archived media (no additional Instagram requests)

The November 9 log included: TAGGED GraphQL `edges=2`, `has_next=false`, but `Δqueue=0`, while the previous script marked `coverage.tagged=true`. **This log by itself does not prove the two tagged items were lost** (both could have been previously discovered/deduplicated). It does prove a weakness in the old completeness logic: `page_info.has_next_page=false` was accepted without verifying whether each returned tagged item was actually represented in the archive. The same risk existed for individual STORY and HIGHLIGHT media.

**New invariant:** every item returned by a completed selected surface must be reconciled against `state.queue` by exact child media ID and source provenance. The proof also rejects incomplete sidecar pages, missing carousel children, malformed counts, count gaps, duplicate children, and media units without a usable URL or indexed file.

- `discoveredMediaResolution(raw, source)` is a pure, no-network **source-to-archive** verification gate. Its success needs a stable unit ID, matching source provenance, recorded filename and a usable URL or verified local archive backing. A download request is *not* itself proof of a successfully written file: the existing download controller remains responsible for write verification.
- **TAGGED:** the scanner now records every discovered root ID in `state.roots.TAGGED`, reports `resolved` and `unresolved` alongside server pagination, and sets `coverage.tagged=true` only if the server explicitly ended AND all returned items passed the archive gate. If edges lack usable media data, the scan stays `INCOMPLETE` and **does not initiate speculative per-item calls**.
- **STORY and HIGHLIGHT:** previously an ended API page/collection could conceal missing child URLs. Their completion flags now fail closed if any returned item cannot be reconciled. Existing complete 176-item / 4-highlight fixtures continue to pass; missing-child fixtures fail as expected.
- **Partial archive:** authenticated Web TAGGED items can now participate in **VERIFIED ACCESSIBLE PARTIAL** only if the TAGGED selection was enabled, its collection is complete, the item source is `TAGGED`, and its root ID is recorded. The plan, surface coverage and sorted tagged-root IDs are included in the immutable download grant fingerprint. A tampered ID/coverage after scanning revokes the grant.
- **PUBLIC shadow:** on missing anonymous SSR, only the requested target gets a single `?hl=en` verification. Previous fallback probes against unrelated `instagram` and `natgeo` accounts were removed. If two target attempts still lack an SSR timeline, the public surface remains **INCOMPLETE**; it is never reclassified as `N/A` because a different account behaved differently. An explicit restriction gate from the requested target remains a valid N/A reason.
- **One transport policy:** both `gmRequest` and native `fetchJson` now apply `unsafePrivateRestMethod` before network dispatch; non-GET calls to `www.instagram.com/api/v1/*` or `i.instagram.com/api/v1/*` are refused locally. Authenticated Web GraphQL POST is unaffected. Automated regression tests verify the `fetchJson` refusal with **zero transport dispatches and zero retries**.
- **Obsolete fallback removed:** the unused static `REEL_FALLBACK_DOC` ID is no longer in APP constants. Verified, target-scoped browser-originated REELS evidence is still the only accepted non-empty REELS completion route.

### Offline acceptance and limitations

New tests: `tests/selected-surface-archive-integrity.test.mjs` executes the production `scanTaggedGraphQL`, `scanStory`, `scanHighlights` and `scanPublicShadow` functions against synthetic mock payloads. It covers 2 TAGGED edges / 0 files, successful matched TAGGED files, empty server-ended surfaces, STORY/HIGHLIGHT item gaps, carousels with partial counts or missing children, and target-only PUBLIC fallback (two calls to the same account, zero to other accounts). Previous 176-file highlight / verified partial tests remain enabled. The CI is not a browser acceptance test.

**Source limitation, independently verified:** the [official Meta Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) does not expose consumer accounts to its professional-account endpoints and therefore cannot fill unknown REELS collections for arbitrary public consumer profiles. The [gallery-dl October 2026 regression](https://github.com/mikf/gallery-dl/issues/9816) is further external evidence that hardcoded Instagram GraphQL queries can fail even when HTTP is 200; it is *not* justification to guess new doc IDs or retry the private mobile `clips/user/` endpoint.

**Remaining blockers:** the absent-tab REELS feed is still unobservable from the available evidence; the current script does not recover or prove hidden-from-grid Reels in this case. A tagged post with metadata but no usable media URL remains unarchived unless Instagram genuinely exposes an authorized usable media payload. No further browser/account scan has been requested or executed by this audit. Existing authenticated REST requests retain a nonzero restriction risk.


## v1.5.86 — native Web Reels observed before the scan, without Reels-tab probing

This offline pass addresses three concrete issues:

1. **Lost pre-scan Reels evidence:** `scanAll` cleared `net.reelsByUserId` unconditionally after identity resolution, discarding any real, user-targeted, native Web Reels response captured just before scanning. `prepareReelsNativeEvidenceForScan(uid)` now preserves only a current-profile native response captured within `PROFILE_BOOTSTRAP_MAX_AGE_MS` (20 seconds), with at least one target-scoped initial request and actual roots. The snapshot is consumed **once**; stale, future-dated, or previously consumed evidence is cleared. A fresh initial native Reel page replaces previous cached roots rather than unioning separate page-load observations.
2. **Absent Reels-tab discovery:** when the tab is absent, the script never opens a speculative URL or GraphQL endpoint, but it can now ingest already-observed, target-scoped native Reels as `REEL_NATIVE_OBSERVED`. A root enters `verifiedPassiveReelRootIds` only when all its media units are present in the archive inventory with the matching root ID, source, filename and URL or indexed file. Such units may enter `VERIFIED ACCESSIBLE PARTIAL`, with the verified root IDs included in the immutable source fingerprint. **The Reels feed is still INCOMPLETE** without independent, exhaustive server pagination. An already-observed native root is NOT a zero-count or full-feed proof.
3. **Origin-scoped network errors:** media CDN and image hosts can produce HTTP 401, 429 or JSON errors that do not mean the authenticated Instagram API session is restricted. `gmRequest` now uses `instagramRequestScope(url)` to open account-level feedback/429/401/challenge circuits only for actual Instagram origins (and 401/checkpoint for Instagram API paths). CDN errors remain individual media failures. This avoids a false session shutdown from a broken or expired CDN URL.
4. **Parent media integrity:** `discoveredMediaResolution` also requires each unit's `rootIds` to contain the exact parent root ID from its current collection, not merely matching a reused source tag or media ID. This blocks cross-root false completeness when a media unit appears in multiple contexts.
5. **Offline testing:** new `tests/passive-native-reels-bootstrap-regression.test.mjs` evaluates the real native capture function, single-use TTL bootstrap, absent-tab scanner, source-checked partial selection, stale/replayed snapshots, cross-profile response rejection, and unresolvable native roots. Existing REELS pagination/no-tab fixtures were updated to include the new metadata. CDN 401/429 isolation is tested for both GM `onload` and `onerror`; 176 Highlights and all other regressions remain in CI.

### Operational interpretation and remaining risk

This capability depends **strictly on genuine browser-native Reels data that Instagram has already exposed for the same target**. It generates **zero additional Reels network probes**. The Nov 9 example (`@jennnii97`), with no Reels tab, no native Reels data and no clips metadata, still cannot be called complete or assumed empty, and no extra Reel will appear unless the browser itself exposes one in a validated response.

These synthetic tests prove the scripted state transitions, not the behavior of Instagram in a real logged-in session. No user/account testing has been performed for v1.5.86, and no account safety guarantee is possible. `main` remains stable v1.5.78; PR #18 remains DRAFT.


## v1.5.86 — TAGGED structural audit (same experimental version, no rollout)

The real November 9 Firefox log reported `TAGGED edges=2`, `resolved=0`, `unresolved=2`. That establishes two discovered roots and zero file reconciliation; without the two raw root payloads it **does not** prove the exact missing field, whether either root is a video, or that Instagram withheld the media.

A source review found three independently verifiable implementation defects:

1. **Media schema gap:** `bestImage()` handled legacy `display_url` and `image_versions2.candidates` but omitted the standard XDT `display_uri` field present in TAGGED GraphQL responses. The reader now prefers maximum-size valid image candidates, then `display_uri` / `display_url`; invalid candidate arrays no longer suppress a valid display URI. For TAGGED, preview-only `thumbnail_url` and profile-avatar URLs are **not** accepted as full photo evidence. The video path still needs `bestVideo()` and will never download a video cover as an MP4.
2. **Native first-page loss:** a previous browser-native TAGGED response was held in global `net.taggedInitialData`, but `scanAll()` always cleared that state immediately after profile resolution. Worse, pre-scan capture was conditional on `state.userId`, which was unset until resolution. Native captures now use the verified numeric **request target ID** as a map key, retain only a successful exact TAGGED connection with explicit page_info and a first-page cursor, and are consumed once within a 20-second TTL *after* resolving the scan target. Wrong-user, stale, replayed, continuation-only and GraphQL-error payloads cannot serve as an initial page. No extra network requests are created.
3. **Wrong connection acceptance:** `taggedConn()` previously fell back to a recursive search for *any* connection with edges, which could accept an unrelated connection. TAGGED completeness now requires the exact `xdt_api__v1__usertags__user_id__feed_connection` response key; GraphQL `errors[]` fail closed. The final log adds aggregated `reasons=...` categories without dumping URLs, cookies, account tokens or per-item private payloads.

The existing source-to-archive `discoveredMediaResolution()` gate remains mandatory. A returned tagged item without a usable full image, video URL or verified indexed local file remains **INCOMPLETE** rather than being mislabeled complete.

**Offline acceptance:** `tests/selected-surface-archive-integrity.test.mjs` executes the real production `bestImage`, `bestVideo`, `isVideo`, `addMedia`, `discoveredMediaResolution`, `captureTagged`, `prepareTaggedNativeEvidenceForScan` and targeted GraphQL connection parsing. It checks XDT display URI images, invalid image candidates, video cover rejection, thumbnail-only rejection, wrong user ID, one-shot TTL, stale data, pagination continuation, unrelated connection and partial GraphQL errors. The full scanAll integration harness was aligned with the new required tagged bootstrap dependency.

**CI:** [Userscript CI success #42559458072](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/42559458072) on `d5d33d07fc37585f33053b843de38f37250083ee`. All steps passed. This is offline code validation, **not** proof that the two real tagged items now download or that hidden REELS are discoverable. No Instagram browser scan or account request was performed, `@version` remains `1.5.86`, `main` remains `1.5.78`, and PR #18 stays DRAFT.
