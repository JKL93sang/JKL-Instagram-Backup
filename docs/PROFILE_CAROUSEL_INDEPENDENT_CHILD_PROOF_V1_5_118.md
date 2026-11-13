# v1.5.118 TEST — Strict two-source, child-level carousel proof for accessible partial archive

## Distinguish three separate realities

The user's Firefox v1.5.117 POST+REEL scan of a private account finished in 9.54 s: native first page 1 + 10 continuation pages ended with 121 distinct verified parent roots, 114 POST + 7 REEL; authenticated account media_count=122. All 121 parent media structures were hydrated, 170 media records were queued (163 POST / 7 REEL); Instagram's final count discrepancy remains **unexplained**. Previous historical 836-receipt manifest (created on a **different PC**) contains 121 known parent identities and all 170 identified media IDs. **The empty userscript-local ledger on the new PC is normal independent storage, not a bug or an indicator that archive files disappeared.** No merging, fake receipts or storage migration planned.

Exactly one POST parent carousel (`CzmMNy7MwNb`) has Instagram's declared carousel_media_count=6 but five explicitly exposed children in the authenticated media-info response. Under v117, five legitimate known media were withheld from ACCESSIBLE PARTIAL, producing 165/170. That is not five absent posts nor a reason to fabricate a sixth child.

## v118 change

**Child-only bounded authorization, never grid/parent completeness**:
- Same-account, same-session browser-native PROFILE root must have correct numeric ID, shortcode, and at least one target-bound native response, and same-source deep media-info hydration must have succeeded and established complete **accessible structure**.
- The explicit native children array and current authenticated deep hydrated queue must agree on every child ID, without extras, duplicates, deleted units, paginated sidecar, pending children, missing image/video URLs, changed media type, conflicting independent child-ID array or incorrect owner/parent. All five must be from both `PROFILE_GRID_NATIVE` and `OWNED_DEEP_HYDRATION` with exact media root binding. Any mismatch -> no grant.
- A **separate immutable set of child media IDs** is created only after hydration for eligible carousels with declared count greater than the five explicitly accessible children. Existing `verifiedPassiveProfilePostRootIds` remains strict and does NOT authorize this root as complete. Do not imply missing sixth child does not exist.
- `verifiedAccessibleMedia()` can authorize exact independently verified children even when `PROFILE=false`, and the source fingerprint tracks this set. Other media, APP.DB, ledger, download paths, full-archive authorization and first-page/terminal guards unchanged.
- v118 may yield **170/170 individually verified ACCESSIBLE PARTIAL units** if Firefox returns identical native/deep evidence. That still means **INCOMPLETE profile archive** because official counter remains 122 vs 121 native.
- Synthetic regression `tests/profile-carousel-verified-children-v1-5-118.test.mjs` covers success 5 accessible / 6 claimed and strict negative cases for owner, root, code, source, child arrays, deleted/pending children, stale session and surface state. No private IDs or media URLs in public test fixtures.

## State and next verification

Experimental branch based on v117 PR #31; stable main untouched. Remain DRAFT until CI fully green and a single read-only POST+REEL Firefox scan shows exact five child grant without a fake sixth / false full completion. Do **not** download a batch to test the grant; inspect logs first. The 122nd parent cannot be reconstructed from the authenticated count alone; if Instagram only exposes 121 parents even at server-end, the missing identity remains **UNKNOWN**, not a script bug whose resolution can be asserted. Avoid speculative synthetic mobile API requests that previously caused server_execution and an unhealthy-session circuit.

The user has confirmed that this test was run on **another computer**; the local GM ledger's zero count is expected and must not be pursued as a regression.
