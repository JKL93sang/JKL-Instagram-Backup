# TEST v1.5.110 — TAGGED carousel count hint vs authenticated accessible children

**2026-11-13. Status:** experimental draft [PR #24](https://github.com/JKL93sang/JKL-Instagram-Backup/pull/24). Official `main` remains stable v1.5.109. Do not merge this branch before a real Firefox acceptance test.

## Actual evidence and narrow root cause

The account owner reports the exact TAGGED post `C2ppQT1sR5z` visibly displays **three** photos/slides in Instagram.

The two existing authorized scans v1.5.106 and v1.5.108 each returned a TAGGED GraphQL listing of three distinct child IDs; a separate fresh authenticated same-origin `/media/<root>/info/` GET returned **the same three IDs**. The archive ledger on 2026-09-28 confirms historical receipts for those same three IDs, not four. The raw TAGGED listing field `carousel_media_count` claimed **4**. The fourth identity is **not known**; it must not be guessed or downloaded by arithmetic.

The stable script's OWNED code already treats `carousel_media_count` as a *declarative hint* and considers a fresh explicit authenticated child array authoritative for **currently accessible** carousel files. TAGGED still treated the very same field as a fatal proof of a missing file even after explicit same-root media-info. This **inconsistency is confirmed by production source review**, not a hypothesis about Instagram deletion.

Instagram may support removing an individual published carousel slide; this *could* produce a metadata/visible-child divergence, but **neither these logs nor our code establishes that a deletion happened here**. A source-caching inconsistency, changed permissions, or a different field meaning remain unresolved.

## New optional, guarded proof

`taggedAccessibleCarouselProof(listing, detailed)` is evaluated **only after** the existing scan receives both independent authenticated data objects; it performs **zero new network requests**:

1. Both objects must refer to exactly the **same positive numeric parent ID**, each must explicitly be a carousel, and each must contain at least two child objects.
2. Both child arrays must be complete inventories of equal size, with the same strictly unique numeric child IDs **in the same order**. The GraphQL count must be a safe integer and **strictly greater** than that list size; the detailed count must be absent or consistent with the list or original hint.
3. Optional independent child inventories `carousel_media_ids` and GraphSidecar edges must contain exactly that same ID list. An extra fourth ID or contradiction blocks acceptance. An unfinished sidecar child page or pending child blocks acceptance.
4. Reject explicit owner/shortcode mismatch, contradictory media types, unexpected carousel parent references and a nonzero `deleted_reason` on any visible child.
5. Existing `discoveredMediaResolution` still verifies **every explicit child** is actually in the archive inventory, tied to the same source and parent ID, and has a usable URL or proven indexed-disk backing. The numeric-count relaxation is restricted to `TAGGED` with an **explicit true proof** from the caller. Any other incomplete media is still refused.

If passed, the scanner may consider **three currently accessible children resolved** while adding **zero fabricated media** and recording a prominent WARN:

> TAGGED accessible carousel count hint mismatch: root=..., declared=4, list=info_same_children=3, status=accessible_units_verified_only. The historical declared count is NOT explained; no fourth media ID was inferred.

The UI diagnostics includes `TAGGED count hints`; JSON export `diagnostics.taggedCountHintMismatches` lists the root ID, shortcode, declared count, accessible count, and `historicalCompletenessUnknown:true`. This warning **must survive** even when `coverage.tagged=true` (source-accessible completion). It **does not prove** that the original publication never had a fourth item.

## Limits preserved

- Private PROFILE `110/122` remains independently `INCOMPLETE`, so the actual @b_kkaaa full scan cannot become `COMPLETE` from this TAGGED change alone.
- Historical `downloadedAt` receipts are **not evidence of physical files on disk** or a currently accessible fourth media item.
- Only the existing single, same-origin, authenticated media-info hydration is used. No hidden/private-access bypass, no undocumented endpoint guess, no retries beyond existing budget, no real media URL in logs, no changes to stable Story SOLO.
- Need to validate on the actual authorized Firefox session before the experimental branch can be promoted to `main`.

## Automated regression

`tests/tagged-accessible-carousel-count-v1-5-110.test.mjs` exercises production helper **and actual TAGGED scanner** with synthetic data. Positive: matching 3/4 → 3 real queued, 1 explicit warning, and fourth explicitly listed → 4 real queued. Negative: different root/owner/shortcode/order/ID/missing or conflicting child, incomplete page, pending child, contradictory media type or parent, deleted child, extra independent ID, and missing URL in both sources. Existing selected-surface/OWNED/profile/Story/distribution regression suites continue.

## Reproduction reference

Stable v1.5.109 (official): https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/main/JKL_Instagram_Backup.user.js

Experimental TEST v1.5.110: https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/fix/tagged-accessible-carousel-proof-v1.5.110/JKL_Instagram_Backup.user.js

Enable **only one** script version at a time. Do not reset the ledger or delete the archive. The next test needs a fresh authenticated scan to observe exactly whether the genuine server shapes satisfy this newly stricter two-source proof; no asserted live-success claim is made here.
