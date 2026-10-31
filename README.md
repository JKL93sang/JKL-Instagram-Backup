# JKL Instagram Backup

A Tampermonkey userscript for backing up Instagram media that is **already accessible to the signed-in browser session**.

Current public version: **1.5.67** (stable, `main`).

## Install or update

Open the official stable userscript URL with Tampermonkey enabled:

https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/main/JKL_Instagram_Backup.user.js

Existing stable users can also use **Tampermonkey → Check for userscript updates**. Both `@updateURL` and `@downloadURL` point to this `main` version.

**If you installed the PR #8 experimental build (v1.5.62–1.5.64):** the stable script has a higher version number, and the test branch also exposes this release metadata. Open the official `main` Raw link once if Tampermonkey does not automatically switch channels. Confirm that exactly one enabled copy remains and that its version is 1.5.67.

## Public PROFILE completeness

The PROFILE native network hook can occasionally miss a first-page response. This release retains strict incomplete status unless one of two independent, identity-scoped evidence paths passes:

- The anonymous PUBLIC SHADOW ends with explicit `page_info.has_next_page=false`; its unique POST/REEL IDs match the verified authenticated profile count and every ID is present in the owned sets; selected REELS, CONNECTED hidden and hydration are complete. Public-grid roots provisionally labelled POST may later be authenticated as REEL, provided their exact IDs are accounted for by completed owned REELS coverage; explicit public REEL roots must remain owned REEL.
- The PUBLIC SHADOW ends with fewer roots than the verified counter, but an independently captured native PROFILE continuation also ends. Their overlapping root-ID union must match the verified count exactly, with every ID validated as owned.

These checks apply only to verified public profiles without exclusive content and with both POST and REEL scan selection, completed REELS and hydration, and a verified empty CONNECTED hidden scan. Other cases remain INCOMPLETE unless native PROFILE coverage is separately proven. No extra API calls are made to force either result.

**Validation:** browser tests confirmed the prior public/native union and the v1.5.67 POST-to-REEL reconciliation path, including a completed PROFILE scan with 124 public roots and 14 subsequently confirmed REELS. Automated regression tests cover incomplete pagination, mismatched IDs, hidden content and other unsafe paths. **A completed scan is not proof that every physical file downloaded:** the latter browser test had one `GM_download` failure out of 129 main media jobs; that downloader issue is tracked separately. This is not a guarantee of universal compatibility or access to private material. Stop scans if Instagram issues an account warning or rate-limit notice.

## Profile identity resilience (v1.5.60+)

Profile resolution first checks the open profile page, then makes at most **one normal authenticated page request** to obtain profile-specific metadata. A single legacy topsearch request is retained as a last resort. The feed/user endpoint that returned redirected HTML is no longer used for identity resolution.

The script **never bypasses login, private content or platform restrictions**. HTTP 429, `feedback_required`, HTTP 401/403 and login/checkpoint redirects still stop the attempt. If Instagram's current page no longer exposes the ID, the scan stops rather than guessing. The entire scan engine remains unchanged.

**PROFILE pagination update:** the candidate now uses only a successful, profile-matched native Instagram Relay query to paginate the profile, preserving its observed document ID, variables and request envelope. It refuses to guess when the capture is missing and still requires explicit `page_info.has_next_page === false` for a complete scan. JSON GraphQL errors also stop safely. No additional fallback retries or unauthorized access are introduced.

**Validation caution:** automated tests pass, but full compatibility with Instagram's live Relay interface still requires a real browser/profile smoke test. Stop if Instagram displays login, checkpoint or account-limitation notices. If a GraphQL profile-completion request still returns HTTP 200 non-JSON, the log will now show only safe diagnostics (response MIME, HTML classification, destination category, redirect yes/no, and whether the native captured query ID differs from the fixed fallback). It does **not** log response bodies, sensitive URLs, cookies or tokens; it makes no additional retry requests. The profile scan remains incomplete and stops.

## What it backs up

Depending on what Instagram exposes to the current authenticated session, the script can archive:

- profile posts;
- reels;
- stories;
- highlights;
- tagged media;
- avatar;
- accessible hidden/preview candidates;
- carousel children;
- individual opened posts/reels/stories through the standalone download button.

The archive is cumulative: media already present locally is preserved and verified instead of being deleted because it later disappears from Instagram.

## Safety model

The script is deliberately fail-safe.

A scan is not considered complete when required pagination or hydration proof is missing. It also stops rather than continuing blindly after conditions such as:

- Instagram `feedback_required`;
- HTTP 429 / rate limiting;
- unhealthy media-info responses;
- repeated or invalid pagination cursors;
- unresolved structural hydration beyond configured safety limits.

The global Instagram publication counter is treated as an informational signal, not as a completeness proof.

## Large accounts

The current safeguards include:

- PROFILE pagination cap: 200 pages (~2,400 edges at 12/page);
- REELS pagination cap: 5,000 pages;
- TAGGED pagination cap: 5,000 pages;
- bulk hydration from 100 unresolved roots;
- bulk batches of 20;
- reduced hydration workers on large sets;
- bounded single-item fallback after bulk hydration.

If a safety cap is reached without a valid end proof, the scan remains **INCOMPLETE** instead of silently declaring success.

## Local archive verification

Use **SCAN LOCAL FOLDER** before relying on historical archive state. Persisted ledger history is advisory until the selected local archive has been indexed and its canonical media IDs verified.

## Media-anchored solo download button

On an opened post, Reel or Story, the single download button is anchored to the **visible media** (top-right overlay) rather than Instagram's changing native action bar or the browser's top-right corner. If a reliable bounded media container is not available, the button is hidden until the viewer is rendered. Grid thumbnail download buttons are unchanged.

## Standalone media download

The injected download button supports:

- `/p/<shortcode>/`;
- `/reel/<shortcode>/`;
- `/tv/<shortcode>/`;
- `/stories/<username>/<media_id>/`.

Highlights are not treated as a single story media ID because their URL identifies a highlight reel rather than an individual media item.

## Automatic updates

The userscript metadata points to:

- homepage: https://github.com/JKL93sang/JKL-Instagram-Backup
- source: https://github.com/JKL93sang/JKL-Instagram-Backup/blob/main/JKL_Instagram_Backup.user.js
- updates/downloads: https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/main/JKL_Instagram_Backup.user.js
- support: https://github.com/JKL93sang/JKL-Instagram-Backup/issues

Every published release must increment both `@version` and `APP.VERSION`. CI checks that they stay identical.

## Development and CI

The public repository contains regression coverage for:

1. permalink/media identity;
2. UI geometry;
3. UI intrinsic-width isolation;
4. OWNED discovery semantics;
5. PROFILE completion proof;
6. large-account safety;
7. standalone download controller;
8. public distribution metadata;
9. JavaScript syntax.

Pull requests are expected to pass the complete GitHub Actions workflow before merging to `main`.

## Privacy

Do not include private account names, session cookies, authentication tokens, personal archive paths, or other sensitive data in public issues.

When reporting a bug, redact usernames and media IDs unless they are intentionally public test fixtures.

## Limitations

This project depends on Instagram's web application and internal interfaces. Instagram can change those interfaces without notice.

The script does **not** bypass account permissions or make inaccessible content accessible. It only works with media exposed to the current browser session.

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by Instagram or Meta.
