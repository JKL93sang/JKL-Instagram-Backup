# v1.5.116 — Native PROFILE partial GraphQL recovery (TEST)

## Root cause shown by a privacy-sanitized Firefox HAR

11 target-scoped native PROFILE timeline pages were observed: one genuine **initial** 12-edge `PolarisProfilePostsQuery`, followed by 10 cursor continuations (`PolarisProfilePostsTabContentQuery_connection`), 9×12 and one final 1-edge page with `page_info.has_next_page=false`. This yields **121 different parent roots** and matches the 121 previously known parent identities exactly, including the ten missing from the preceding partial scan. The authenticated numeric `media_count` value was **122** and must not be treated as a fabricated missing ID.

Five out of 11 GraphQL responses contained `errors` despite exposing a full timeline connection and 12 identifiable roots each: 5 errors on the initial page, and 1 error each on four 12-edge continuations. The remaining six pages contained **61 roots**, exactly matching the native capture count of the previous userscript version. The older captureGrid() discarded a whole response for any non-empty top-level `errors` array.

## Patch and proof guards

- `nativeProfilePageAdmissibility`: accepts a page with nonfatal top-level GraphQL errors **only** if the exact named timeline connection is present, the pagination boolean is present, a continuing page has a cursor, and **every distinct root has a numeric ID that matches its canonical shortcode**. The existing native request-to-current-profile binding must also hold; unrelated, empty, duplicate, malformed or incomplete page structures do not qualify.
- Native browser `fetch` and `XMLHttpRequest` parsers accept standard JSON, optional `for (;;);` anti-JSON-hijacking prefix, and strictly parsed newline-separated Relay JSON documents. No script-authored media-discovery traffic is introduced by either change. Non-JSON remains an API-health error on known profile queries.
- Keep individual media hydration and source coverage separate; a structurally observed root cannot prove all carousel media exist or were downloaded. No ledger mutations or false archival success claims.
- Added synthetic test `tests/profile-native-partial-graphql-v1-5-116.test.mjs` reenacting the sanitized HAR 11-page/121-root structure without any private IDs or usernames; malformed structure and wrong target are rejected. CI invokes the new test.
- **Remaining independent issue:** one observed carousel advertises `media_count=6` but the current media-info response includes only **5 child IDs**. Do not invent or download a sixth image. Native end at 121 vs profile counter 122 is not sufficient by itself to explain the extra counter unit or prove full coverage.

## Status

Test branch based on v1.5.115; stable `main` unchanged; development PR remains DRAFT until real Firefox POST+REEL scan and associated TXT+JSON verify correct first-page capture, 121 independent parents where accessible, exactly scoped error recovery, terminal pagination, and no false COMPLETE. The previous v1.5.115 PR #29 remains unmerged. Do not publish sanitized HAR account IDs in repository tests or docs.
