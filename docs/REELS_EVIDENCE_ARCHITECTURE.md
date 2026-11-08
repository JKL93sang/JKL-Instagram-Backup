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
