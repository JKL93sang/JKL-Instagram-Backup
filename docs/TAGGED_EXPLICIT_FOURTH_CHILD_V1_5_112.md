# TEST v1.5.112 — explicit fourth child in authenticated TAGGED carousel

## Observed real Firefox evidence (2026-11-13)

The previous TEST v1.5.111 was run with **TAGGED as the only selected surface**, no downloads. It completed 7 GraphQL pages, **77 listed roots / 76 resolved / 1 unresolved**, and the full scan took **26.73 seconds**. In the exact unresolved carousel:
- Both authenticated responses agreed on carousel parent ID, owner, shortcode, media type, `carousel_media_count=4`, and the **same three visible child IDs in the same order**.
- The authenticated **parent media-info separately returned `carousel_media_ids` with 4 entries**. GraphQL listing did not include that independent array.
- Sidecar `has_next_page=false`, both pending counts zero. The v1.5.111 safe rejection reason was `independent_child_ids_conflict`. This is **not** an ordering mismatch and **not** mere count-hint ambiguity.
- Neither the previous log nor manifest exposed the value or availability of that fourth ID. **Do not invent it, declare it deleted, or claim the collection is complete.**

The historical path safeguard independently worked: eleven previous, exactly native-verified POSTS were retained in their original 2022–2024 POSTS paths when TAGGED was scanned by itself, without adding even one current PROFILE root. The TAGGED-only manifest has 117 current unit records, historical ledger 836; these are not meant to match the full 826-unit scans because the selection excludes other surfaces. The unchanged historical ledger is not current download proof.

## Implementation / safety constraints

`taggedExplicitMissingChildCandidate` accepts a candidate **only when**:
1. Authenticated parent identity/type, matching owner/shortcode and matching safe declared child count are proven.
2. Both child-object arrays expose the same unique `count-1` numeric IDs, with no pending or unfinished sidecar pagination and no contradictory child parent/type/deletion evidence.
3. Media-info independently lists **exactly `count` distinct numeric child IDs**, matching all visible children plus exactly one ID not in either displayed array. Optional duplicate ID inventory from listing or sidecar must agree.

Only then `scanTaggedGraphQL` may make **one same-origin, one-attempt GET** on `https://www.instagram.com/api/v1/media/{exact_server_enumerated_id}/info/` for the actual missing ID. **At most two** such requests per entire scan (not per root). This is the same existing Web endpoint and policy as the parent's media-info hydration; no alternate host, retries, guessed ID, mobile endpoint, or login bypass.

`taggedValidateExplicitChild` rejects a wrong returned ID, wrong explicit parent or owner, deleted/unsupported media type, or absent actual HTTPS JPEG/MP4 media URL. Only an authenticated real child object that passes the checks can be attached to the real parent and passed again through ordinary `addMedia` + strict `discoveredMediaResolution`: **all four must have actual validated file units** before `TAGGED=true`.

On a legitimate absent/denied child, remain `INCOMPLETE` and log exact `TAGGED explicit fourth child … status=…`, e.g. `child_media_info_unavailable`, with the status code when available. Export the concise `diagnostics.taggedExplicitChildProbes` in the user's local manifest (identifier, declared count, known count, status); no raw media URLs, HTTP headers, cookies or tokens in diagnostics. Normal authentication circuit breakers remain unchanged.

Preserve original tested Story SOLO and historical POSTS naming safeguards. Main stable **v1.5.109 never touched**.

## Automated evidence and next test

[Draft PR #26](https://github.com/JKL93sang/JKL-Instagram-Backup/pull/26), CI [#459 successful](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/43367908388) (52 successful steps). Synthetic authenticated-root integration tests:
- Honest extra ID plus real child media-info `4/4` enables successful single-root proof.
- Child identity mismatch, wrong parent, unavailable HTTP 404 and duplicate child-ID inventory **all fail closed**.
- Exactly one parent GET plus at most one independently identified child GET; native PROFILE membership remains unaffected.

**Not yet tested on a real Firefox account.** For next acceptance use TEST v1.5.112 only, TAGGED-only selection, scan, and export TXT logs. A valid fourth URL might not be available; a fail-closed diagnostic result is still valuable. No full profile scan, download or archive deletion needed.

TEST script URL:
`https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/fix/tagged-explicit-fourth-child-v1.5.112/JKL_Instagram_Backup.user.js`
