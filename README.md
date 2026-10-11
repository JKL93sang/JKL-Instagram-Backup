# JKL Instagram Backup

A Tampermonkey userscript for backing up Instagram media that is **already accessible to the signed-in browser session**.

Current public version: **1.5.58**

## Install

**Tampermonkey:** open the raw userscript and confirm installation:

https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/main/JKL_Instagram_Backup.user.js

The userscript contains its own `@updateURL` and `@downloadURL`, so Tampermonkey can check this repository for later versions automatically.

> Existing installs that were previously copied manually from the private development repository must install **1.5.57 once** from the public Raw URL. After that, future version checks use this public repository.

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
