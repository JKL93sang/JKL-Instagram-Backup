# v1.5.98 TEST — read-only PROFILE source gap diagnostics

## Motivation and verified observations (2026-11-11)

- Firefox v1.5.96 `@petit._tigre` reported authenticated main-grid count **117**, but only **115 observed main-grid roots** (63 POST + 52 REEL). The independent REELS tab was server-ended at **361 distinct REEL roots**; TAGGED six, Highlights four collections, OWNED 424/424 hydrated, QUEUE 780. Subsequent download log confirms **780/780 GM_download success callbacks**, none failed or blocked (830.38 s). Nothing in the supplied data identifies two specific missing PROFILE root IDs.
- User observed a Reel behind a content/age warning requiring an Instagram “Voir le Reel” click. This could affect visual presentation, but **there is no proof it explains the 115/117 main-grid gap**. The Reel may already be in the independently completed 361 REELS. Do not infer gaps from UI or try to bypass restrictions.
- The user wants working, safe code before optional parent-folder functionality; no repeated 780-file downloads.

## v1.5.98 read-only source/provenance audit

Source `JKL_Instagram_Backup.user.js` adds two **per-scan diagnostic-only** Sets:
- `state.profileMainGridRootIds`: snapshot of POST+REEL root IDs at the end of native PROFILE scanning, *before* visiting the independent REELS tab. These are observed current main-grid roots, not proof of server-ended pagination.
- `state.profileDomObservedRootIds`: numeric IDs from grid DOM links seen during PROFILE scanning. DOM links are only candidates and do not authorize completeness.

No new fetch, query, Web request, Instagram API, fallback or UI interaction was introduced. The existing authenticated `net.gridByUser`, anonymous `state.shadow.rootIds`, and independent `net.reelsByUserId` remain separate and unmodified.

`profileSourceDiagnosticSnapshot()` produces a JSON-serializable object `kind=PROFILE_SOURCE_DIAGNOSTICS_ONLY` including:
- Exact numeric arrays `rootIds.public`, `rootIds.native`, `rootIds.domCandidates`, `rootIds.mainGridSnapshot`, `rootIds.independentNativeReels`.
- Counts `public`, `native`, `domCandidates`, `mainGridSnapshot`, `independentNativeReels`, `publicNativeUnion`, `publicNativeOverlap`, `mainOutsidePublicNative`, `mainAlsoSeenInDom`, `mainAlsoInIndependentReels`, `observedUnionIncludingDomCandidates`, `gapMainVsCounter`, `gapPublicNativeVsCounter`.
- Account ID / username, authenticated counter only if consistent, true PUBLIC/native pagination-end flags, and an explicit caution against treating DOM/REELS counts as PROFILE proof.
- A concise `PROFILE SOURCE AUDIT (diagnostic only)` summary in the session logs once all selected scan phases have finished.
- The same full diagnostic object at `diagnostics.profileSourceDiagnostics` in the existing **EXPORT MANIFEST** file, so the media permalink of any age-gated Reel can be reconciled offline against sets without repeated Instagram requests.

`EXPORT LOGS (.TXT)` from v1.5.97 remains intact, with 2000 visible and up to 50,000 saved session lines. `EXPORT MANIFEST` is still a local Blob JSON download.

**Security boundary:** these snapshots are never read by `profileSurfaceOperationalSkip()`, `reconcileProfileGridCoverage()`, `completedScanIntegrity()`, `authorizeDownloadScope()`, or `verifiedAccessibleMedia()`; they cannot grant extra downloads, fabricate a PROFILE `has_next_page=false`, move main-grid roots into REELS, or override `feedback_required` / 429 stops. DOM candidates are explicitly untrusted as profile membership proof.

## Automated evidence and next acceptance

`tests/profile-source-audit-regression.test.mjs` executes the actual snapshot helper with a realistic simulated counter gap, 89 PUBLIC IDs, 40 observed native IDs with overlap, 115 main grid IDs and 361 independent Reel IDs. It verifies exact intersections, **115/117 remains missing 2**, URL candidates cannot add main-grid roots, wrong authenticated count fails closed, and the generated source arrays round-trip through JSON correctly. The test explicitly covers a Reel present only in REELS (not main). An existing full-scan integration harness was updated to include the new diagnostic helper and retain the previous scan semantics. All existing tests remain in the CI.

[CI SUCCESS #42937957625](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/42937957625) at tested commit `fed7a49b5176acee76c0714d528b1bf6b74a31fd`; recheck CI on final documentation HEAD.

No new live Instagram scan, media download or user account access has been performed here. A **future user-initiated scan** on v1.5.98 can now generate both `EXPORT LOGS (.TXT)` and `EXPORT MANIFEST` for comparison. The previously uploaded truncated v1.5.96 log cannot retroactively provide root-source ID lists. No scan should be repeated solely to verify the prior successful 780/780 download result.

Production `main` remains v1.5.78, experimental PR #18 DRAFT, parent-folder feature deferred.
