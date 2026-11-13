# TEST v1.5.113 — bounded known-sibling endpoint control after orphan HTTP 400

## Evidence from real Firefox 2026-11-13 v1.5.112

Full user log (40 entries, 0 lost), manifest recorded the account's TAGGED-only scan:
- 7 GraphQL pages / 77 roots / 76 proven media-complete roots / 1 unresolved carousel, 25.79 s TAGGED, 26.39 s total.
- Parent `3290342443491335795`, post `C2ppQT1sR5z`, both authenticated sources 4 declared, 3 materialized child objects. Media-info `carousel_media_ids` is an independent list of **4 actual numeric IDs**.
- Fourth server-enumerated numeric ID is **`3290342439934658721`** (new factual information, not a guessed id).
- A **single** authenticated same-origin media-info GET for that child returned **HTTP 400**, `child_media_info_unavailable`. It did **not** return a media URL; the fourth is **not** added to the 117 media-unit queue nor to the 836-unit historical ledger.
- `taggedHistoricalPostRestored=11` remained correct. `INCOMPLETE` remained correct. No profile scan was requested (zero OWNED expected).

### Question a raw HTTP 400 does NOT answer

Is the fourth slide missing/blocked, or does `/api/v1/media/{id}/info/` refuse **all carousel children** as top-level lookups, even known visible children? Publishing API 400 reports found online are unrelated and must not be confused with this private Web endpoint.

### Controlled experiment

After exactly one missing-child GET **returns HTTP 400**, make precisely **one** same-origin `/api/v1/media/{id}/info/` GET for a **known fully materialized sibling ID** already in both authenticated parent responses. All headers/policies/retry behavior identical, `singleWebOnly:true`; never make arbitrary or guessed requests. Limit: **one sibling control GET per full TAGGED pass**, even if multiple orphan carousels. No duplicate calls on every page.

- `known_child_reachable`: the same endpoint returned a valid child object **with the exact sibling ID**, narrowing the fourth slide problem to that item or its status, but still not proving deletion.
- `same_http_400`: known good sibling also gets HTTP 400, indicating likely endpoint-level inability to fetch individual carousel children, *not* evidence that fourth is deleted.
- `identity_mismatch` or other status: inconclusive, no false claims.
- No additional GET after HTTP 404 or 200; authentication, rate-limit, feedback and cancellation safety circuits preserved.
- No new media records, ledger receipts, fake downloaded units or coverage changes from this diagnostic. `TAGGED=false` remains until all 4 real children supplied with URLs.

Diagnostic output:
- TXT: `TAGGED known-sibling control: root=…, known_id=…, result=known_child_reachable|same_http_400|identity_mismatch|…`.
- Manifest: `diagnostics.taggedExplicitChildProbes[0].siblingControl` with sibling ID, result, optional HTTP status. No raw bodies/headers/session tokens/media URLs.

### Testing

Synthetic executable tests: known sibling 200 valid ID vs 400 vs wrong identity, no archive side effects, single sibling GET, zero sibling GET when missing child returns 404. All other strict guards untouched.

Branch: `test/tagged-carousel-sibling-control-v1.5.113`. **TEST only, no main merge**. This is a diagnostic experiment, not yet a fix and never a claim of complete archive.

Installation: `https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/test/tagged-carousel-sibling-control-v1.5.113/JKL_Instagram_Backup.user.js`

Next: TAGGED-only on Firefox (all other surfaces unchecked), SCAN; export TXT only; inspect `TAGGED known-sibling control`. If `same_http_400`, stop child endpoint probing, then inspect native parent post viewer with a separate human-controlled targeted assessment. If `known_child_reachable`, investigate why orphan 400 without retry storms.