# Stable v1.5.109 — Verified Instagram Story SOLO

**Release date:** 2026-11-13 · Source branch: `release/story-solo-v1.5.109` · Production distribution: `main`.

## Why v1.5.109

The preceding stable `main` was v1.5.105. The **v1.5.107** experimental code was accepted by an actual Firefox user session for two explicit checks: the floating SOLO button appears at `https://www.instagram.com/stories/b_kkaaa/` (Instagram presents no numeric story ID in this route) and clicking the button actually downloads the currently selected Story. The production release deliberately skips the failed v1.5.108 PROFILE/TAGGED experiments and therefore uses the next version **1.5.109**.

## Changes

- Parse the precise `/stories/<username>/` viewer route as a **viewer**, not an invented numeric media ID.
- Mount the viewport-pinned SOLO button even if the ordinary post/reel media root is absent.
- On explicit click only, request the existing authenticated same-account Story reel. Select its sole actual child or, if there are multiple, uniquely identify the currently displayed media against the authenticated file paths. Reject ambiguities, unexpected profile/route changes and stale clicks. Recheck after media-info, before downloading.
- Preserve previous `/stories/<username>/<numeric-ID>/` direct route and existing POST, REEL, TAGGED, HIGHLIGHT, PROFILE and file/ledger checks.
- Retain v1.5.106 bounded TAGGED media-info recovery and private PROFILE diagnostics, already exercised by the user's v1.5.106/v1.5.108 full Firefox scans. No source-completeness promises.
- Proper stable `@version`, `APP.VERSION`, and `@source`, `@updateURL`, `@downloadURL` **all target main**.

## Verification

- v1.5.107 Story button and single Story download in real Firefox confirmed by user.
- v1.5.107 CI #43348607327 succeeded.
- Full Firefox private-account scan of v1.5.108 (which inherited the v1.5.107 Story code) showed no regressions in the other surfaces; the experimental viewport-sweep/carousel-union added zero recovery.
- v1.5.109 release-candidate CI #43357571989 succeeded, including direct-Story and username-only-Story executor/route regression tests and distribution metadata validation.
- Explicit code audit verified **no v1.5.108 experimental `sweepProfileDomViewport` or `verifiedTaggedCarouselUnion` function** survives into this release.

## Known source limitations, not regressions

On authorized private account `@b_kkaaa`, Instagram advertises 122 posts while the verified main PROFILE shows 110 (plus one independent REEL outside the main grid). The initial native PROFILE request was not captured; the final continuation response alone is not enough to assert completeness.

The TAGGED endpoint returns 77 roots, but one carousel `C2ppQT1sR5z` claims 4 children and two independently authenticated responses both provide the same 3 IDs; the fourth is not recoverable from those requests. These outcomes stay explicitly `INCOMPLETE`. An archive ledger's historical receipts are not proof of present file or current Instagram availability. The v1.5.109 release does **not** attempt to hide these gaps.

## Installation

Stable script: `https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/main/JKL_Instagram_Backup.user.js`

To move from a TEST branch to stable, **disable the TEST userscript** and enable just the stable main distribution (same `@name` and `@namespace`). Do not delete download folders, local archive indexes or ledger database.

## Rollback

A non-destructive backup ref of the pre-release stable source has been recorded at `backup/main-v1.5.105-2026-11-13` (SHA `568873c71835f8c1e6421cfdadad9f4773ca795b`). GitHub release PR and commit history enable a review/rollback; do not automatically rewrite main if an unrelated user report arises.
