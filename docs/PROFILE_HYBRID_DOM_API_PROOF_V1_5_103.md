# v1.5.103 TEST — strict hybrid PROFILE proof for fully recovered DOM-only POST roots

**Status:** proposed, TEST branch only, PR #18 remains DRAFT; `main` v1.5.78 must not be changed based on synthetic CI alone.

## Real user evidence (2026-11-12, v1.5.102)

The authenticated `@petit._tigre` profile declares **117** main-grid publications. The user-supplied manifest identifies:

- PUBLIC SHADOW: **89** roots, real server end;
- authenticated native PROFILE observer: **93** roots, real native pagination end from the observer;
- overlap: **67**, public/native union: **115**;
- current profile grid snapshot and DOM: **117** roots (65 POST + 52 REEL);
- exactly two POST roots absent from public/native union, nevertheless resolved through individually targeted media-info following naturally visible profile-grid permalinks:
  - [CvE3dBpoml0](https://www.instagram.com/p/CvE3dBpoml0/) (`3153889526261377396`), 3 photos;
  - [C2XDaGLIaoT](https://www.instagram.com/p/C2XDaGLIaoT/) (`3285109440665201171`), 6 photos.
- 361 REELS from a separate independently completed tab (309 outside main) never form part of the main-grid completion proof.
- The user has successfully downloaded those two carousels with SOLO and reported an archive inventory increase from 780 to 789. The original complete archive coverage claim remained `PROFILE=false` and `INCOMPLETE`. File count is not proof of Instagram source completion.

The previous `assessProfileGridCrossSurfaceProof()` intentionally rejected 115/117 despite two paginations ending. That protected against arbitrary additions from DOM or independent REELS, but it also had **no controlled way to accept independently confirmed individual POST roots**.

## New proof design

### Capture: only for real media-info fetched from visible POST permalinks

- When the existing `hydratePermalinkRoots(..., 'PROFILE_GRID_DOM')` retrieves a visible **/p/** permalink, it now verifies the **server-returned** media-info object:
  1. Requested numeric parent media ID matches the returned root.
  2. Returned `item.user.pk` (or `owner.id` variant) matches the already authenticated profile ID.
  3. Returned shortcode equals the observed permalink shortcode and decodes to the same parent ID.
  4. Object is an ordinary POST, not a REEL.
  5. The **real standalone all-or-nothing media-unit validator** resolves *every* child ID and URL, rejects duplicated/missing/partial carousels and unfinished child pagination.
- Only then does the script accept the root into the authenticated OWNED set; it adds the ID to `state.verifiedProfileDomApiRootIds` **only if** its root catalog is structurally complete, child queue count equals expected, and it is a verified POST. These are **session-only ephemeral evidence IDs**, cleared before each scan.
- Existing hydration from a `/reel/` link remains on its former path. It never contributes to this special DOM POST proof.
- No new Instagram requests, speculative GraphQL completion or change to media download semantics were introduced. Existing two media-info fetches are simply checked more carefully.

### Completion: only after the original strict pagination proof

The new `assessProfileDomApiSupplementProof()` runs **only** when the original `assessProfileGridCrossSurfaceProof()` has already determined `public_native_union_counter_mismatch`. That means the original guards already verified a public account, target identity, both real PUBLIC/native end-of-pagination flags, overlap, counters, zero unresolved connected-hidden candidates, no fan-club ambiguity, and completed OWNED hydration.

The supplemental proof then requires:

- exact main-grid root snapshot of **117**, exact same **117** DOM IDs (captured *before* scanning the separate REELS tab);
- public/native union is a subset of that exact main-grid snapshot;
- union lacks exactly the same number of POST IDs as declared in the authenticated counter (2 in the user example);
- **every single missing root** is in the session's independently validated `verifiedProfileDomApiRootIds` and matches owned POST root membership, never an independent REEL.

If and only if all checks pass, the scanner marks PROFILE covered with explicit reason:

`public_native_dom_api_exact_counter_proof`

This proves an exact **hybrid inventory** (exhausted public/native timelines plus individually verified missing root IDs). It **does not claim the missing posts appeared in either paginated response**. The detailed log says exactly how many DOM roots were supplemented. Any missing evidence leaves PROFILE `INCOMPLETE`.

## Tests / release

- `tests/profile-dom-media-info-bridge-regression.test.mjs`: executes the production standalone carousel validator, exact owner/root/shortcode proof, cross-surface proof, supplemental proof, actual `hydratePermalinkRoots()` and full `reconcileProfileGridCoverage()`; tests success and fail-closed behavior when owner, identity, category, pagination, full child count, DOM snapshot, hidden state, or counter is wrong.
- Old v1.5.102 tests asserting 115/117 without verified DOM API roots continue to reject the archive; they must **not** be disabled.
- Real-browser acceptance pending on v1.5.103: select the existing indexed local archive (789 files, if unchanged), run **one normal profile scan on @petit._tigre**. If all proofs are present, expect the new explicit bridge log and PROFILE=true, and, if every other selected coverage guard remains complete, `SCAN FINISHED — COMPLETE`. If not, export the **TXT logs and manifest** once; identify the missing guard rather than changing the displayed status artificially.
- **No download necessary**: 789 already indexed means this is a scanner-source proof test. Do not re-download historical 780 items or the nine recovered SOLO items.
- Release decision: CI success is mandatory, but **not sufficient** to merge the experimental PR into `main`. The real browser result must establish the new hybrid proof under live Instagram responses.

Detailed previous file-by-file comparison: [PROFILE_DOM_TWO_ROOTS_NINE_FILES_2026_11_12.md](./PROFILE_DOM_TWO_ROOTS_NINE_FILES_2026_11_12.md).
