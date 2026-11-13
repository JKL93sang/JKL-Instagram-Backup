# TEST v1.5.115 — PROFILE progressive DOM capture and independent REELS audit

Status: **TEST ONLY**, never merge or mark COMPLETE without Firefox evidence. Stable `main` is unchanged. Based on the v1.5.114 historical read-only audit.

## Evidence from private on-device test (not committed to this public repository)

- POST + REEL were selected. Authenticated Instagram count: 122. The scan verified 91 POST parents and 7 REELS, representing 134 media units. The ledger inventory remained byte-for-byte equal to the prior manifest (836 receipts).
- Main PROFILE DOM contributed 97 candidate parent permalinks; 96 resolved by authenticated exact media-info. A single multi-media parent remained rejected as `incomplete_media_units`. No first-page native contract was observed (`initial=0`, `continuation=0`) and no PROFILE server-end was proven.
- REELS DOM displayed 7 verified REEL roots; the native Web capture had 0 observed requests. Two REELS were resolved from `REEL_DOM` beyond the five already in the main PROFILE grid. A missing REELS native end still prevents an exhaustive verdict.
- An earlier run in the same browser page had 106 main PROFILE DOM candidates; the recent 97 were a **subset**. Nine previously seen permalink roots, clustered in the middle of the chronology, were missed on the latest pass. That is evidence of fluctuating DOM capture, **not** proof of deleted Instagram posts. Jumping directly to `document.body.scrollHeight` on every loop is a plausible source of missed intermediate/virtualized DOM nodes; the proposed change is to scroll in increments of 80% of the viewport.
- v1.5.114 historical diagnostic incorrectly counted only 96 current parents although all 98 had individual proof: its REELS input considered the native Relay map alone and omitted verified REELS DOM-only roots.

## Implementation

1. `profileScrollTarget()` computes a clamped, non-skipping 80% viewport scroll increment for PROFILE. Mid-page moves get the existing short `PROFILE_SCROLL_MIN` delay; at the actual bottom, the existing bounded wait for native height/network progress remains. The browser itself initiates any lazy-loaded requests. No fresh script-authored Instagram API calls.
2. `reelsTabObservedRootIds` collects only **visible and resolved** REELS-tab DOM roots, and is reset at each scan start. Historical reconciliation uses the union of those roots and the already-observed native REELS map. This corrects the read-only count; it does not add download records or PROFILE ownership.
3. PROFILE source diagnostics export `independentReelsDom` count and ID list separately from `independentNativeReels`. Neither field permits PROFILE pagination or REELS exhaustive completion.
4. Synthetic test covers geometry, non-skipped viewport, absent native REELS response, synthetic source scopes and no mutations to PROFILE membership.

## Expected Firefox validation

Run **POST + REEL only**, no TAGGED, HIGHLIGHT, STORY or AVATAR. Export TXT logs and JSON manifest. Compare distinct observed DOM roots, verified post/reel counts, and historical reconciliation against the prior run. `reels_dom_verified=7` and `current_main_plus_reels=98` are expected **if the same observed roots and categories remain accessible**; they are not hard-coded values. Inspect whether native PROFILE and REELS server-end proofs are still missing, and whether the unresolved carousel still fails. Do **not** reset the ledger, delete files, mass-download an unverified scan, or infer media deletion from a counter gap.

The CI tests are synthetic and do **not** constitute real Instagram server-side pagination evidence.
