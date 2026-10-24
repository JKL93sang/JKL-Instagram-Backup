# Changelog

## 1.5.59 — Profile identity fallback (candidate)

- Investigates Instagram 404 from topsearch and HTTP 200 HTML from the older feed/user fallback.
- Resolve a profile ID from currently displayed page metadata when available, or fetch its ordinary authenticated profile HTML once.
- Validate requested username, final profile route and optional canonical URL before accepting only explicit profile ID metadata.
- Retain a single search request only as last resort; remove the redirected feed/user fallback.
- Do not retry on HTTP 429, feedback_required, 401/403 or login redirects.
- No change to the scan engine, downloading, ledger or solo-download controls.
- Add dedicated profile HTML identity and guard regression tests, plus non-sensitive diagnostic classification of non-JSON GraphQL responses (MIME, body type, redirect category) and native GraphQL doc-ID comparison. No extra diagnostic requests. Browser smoke test remains required before publishing.


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
