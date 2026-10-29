# Changelog

## 1.5.62 — PR #8 experimental test-channel build

- **Not a public release.** Exposes the native PROFILE discovery architecture from PR #8 for controlled browser validation.
- Bump the userscript metadata and internal version together to `1.5.62`, so Tampermonkey recognizes it as newer than public `1.5.61`.
- Pin `@source`, `@updateURL` and `@downloadURL` to the PR #8 test branch, preventing the experimental installation from updating against stable `main`.
- Preserve `@name`, `@namespace` and the complete runtime behavior unchanged. Subsequent browser validation is still necessary.
- Returning to the stable channel requires installing the `main` version explicitly.


## 1.5.61 — PROFILE pagination connection arguments

- Supply four explicit forward-pagination parameters on the second and subsequent native Relay pages: after, before=null, first and last=null.
- Determine page size from the observed native query rather than inventing it.
- Keep other captured Relay providers and metadata unchanged.
- Preserve explicit completion proof, stop-on-error behavior and existing download functionality.
- Add regression tests for initial pages, next-page cursors and missing page-size information.
- Live Instagram verification remains necessary.


## 1.5.60 — Instagram profile resolution and native Relay pagination

- Investigates Instagram 404 from topsearch and HTTP 200 HTML from the older feed/user fallback.
- Resolve a profile ID from currently displayed page metadata when available, or fetch its ordinary authenticated profile HTML once.
- Validate requested username, final profile route and optional canonical URL before accepting only explicit profile ID metadata.
- Retain a single search request only as last resort; remove the redirected feed/user fallback.
- Do not retry on HTTP 429, feedback_required, 401/403 or login redirects.
- Native PROFILE pagination is fixed to replay a successfully captured GraphQL request (document ID, profile-scoped variables, endpoint, body and headers) through the already existing Relay client; it no longer sends an incomplete hand-built POST. A missing native template leaves the scan incomplete rather than sending a guessed query.
- GraphQL HTTP 200 JSON error payloads now trip the API safety stop instead of being treated as a blank page. The rest of the scan engine, downloading, ledger and solo-download controls remain unchanged.
- Add dedicated profile HTML identity and guard regression tests, plus non-sensitive diagnostic classification of non-JSON GraphQL responses (MIME, body type, redirect category) and native GraphQL doc-ID comparison. No extra diagnostic requests. Automated CI tests pass; browser smoke testing on the updated Instagram interface remains pending.


## 1.5.58 — Media-Anchored Solo Button

- UI-only update: place the opened-media solo download button over its visible image/video container instead of the native action bar or browser viewport corner.
- Prefer on-screen media by visible area and centrality, with extra weight for video in Reel/Story viewers.
- Hide the opened-media button when no reliable bounded host is available rather than leaving a remote or misleading control.
- Keep working solo download transport, event capture, profile-grid buttons, entire backup engine and public Tampermonkey metadata unchanged.
- Extend single-download UI placement regression tests. Live Instagram validation is still required.


## 1.5.57 — First Public Release

- First release distributed from the public `JKL-Instagram-Backup` repository.
- Based on the validated 1.5.56 private-development codebase.
- Adds public Tampermonkey distribution metadata:
  - `@homepageURL`;
  - `@supportURL`;
  - `@source`;
  - `@updateURL`;
  - `@downloadURL`.
- Keeps the existing `@name` and `@namespace` unchanged so existing Tampermonkey installations retain the same script identity when upgraded manually to this release.
- Adds a public-distribution regression suite that locks the canonical repository and Raw update URLs.
- Imports the existing regression suites without private development history.
- Anonymizes real account names from public test fixtures.
- Publishes a clean public README, MIT license, pinned GitHub Actions workflow, and Dependabot configuration.
- No scan-engine behavior change from 1.5.56.

## 1.5.56 and earlier — Private Development

Versions up to 1.5.56 were developed and validated in a private repository.

The private commit history is intentionally not copied into this public repository. Public history starts with the distribution-ready 1.5.57 baseline.
