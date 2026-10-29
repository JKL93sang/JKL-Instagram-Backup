# PROFILE discovery architecture — native evidence and completion

**Status:** refactor candidate; not production-validated. This is an internal engineering spec for the JKL Instagram Backup userscript. Do not equate CI success with real Instagram compatibility.

## Problem and evidence

Version 1.5.61 successfully resolved an accessible profile with 22 visible publication roots and successfully fetched a profile GraphQL page with 12 edges. It then received a server GraphQL error on the first synthetic continuation request (safe log category: `other`). The server had reported `page_info.has_next_page=true`, so **22 roots matching the profile counter was NOT proof of completion**. The server-error message has not been independently observed, and the exact cause is unknown.

Earlier attempted fixes changed the document ID, Relay envelope and cursor arguments without establishing the exact server contract for a native continuation. This architecture explicitly rejects that practice.

## Trust boundaries

1. **Instagram-native traffic**: only fetch/XHR initiated by the website itself and observed by the hook. A successful response must be correctly scoped to the active target and include an expected connection.
2. **Userscript traffic**: standalone API and backup requests must use the saved original fetch transport, bypassing the website's native traffic observer. Self-originated GraphQL may not register as newly learned Instagram request evidence.
3. **Visible DOM**: usable to discover candidates for safe hydration, never proof that the entire timeline is exhausted.
4. **Counter**: `media_count` describes the site's reported number, which may not agree with hidden media, reels or inaccessible posts. It can indicate a need for verification but cannot prove the end.

No outgoing request is added merely to obtain diagnostics.

## Trusted data progression

| Evidence state | Meaning | Permitted action |
| --- | --- | --- |
| IDENTITY | Verified target profile ID and URL | Begin discovery |
| NATIVE_INITIAL | A successful native first-page response scoped to target | Capture media, profile query structure and page_info |
| NATIVE_CONTINUATION | A successful *native* response whose request contains a non-empty `after` cursor | Store exact continuation query structure separately |
| VERIFIED_END | A target-matched response has `page_info.has_next_page === false`, with valid provenance and completion policy | Eligible for complete status if other selected phases pass |
| INCOMPLETE | No native continuation contract, missing cursor, repeated cursor, page cap, unexpected connection, unresolved roots, or missing end proof | Keep scan incomplete; do not enable full backup |
| STOPPED | Instagram feedback_required, HTTP 429, rejected GraphQL or invalid API response | Stop immediately and never silently retry |

## Contract provenance

`net.gridNativeAuditByUser` records **only** safe counters and structural tags: number of first-page and continuation responses, cursor-location class (`root`, `nested`, `absent`), and last page_info category.

`net.gridQueryByUser` stores the most recent target-scoped successful native response contract.

`net.gridNativeContinuationByUser` is the separate successful native continuation contract. A later initial-page re-entry cannot overwrite it.

A native continuation can be replayed only when it has already succeeded for the current target. The script refuses to invent a cursor field for an initial-page-only contract. When no such verified continuation exists, return `ended=false` and `native_continuation_unavailable`. A synthetic first page or generic document ID does not establish provenance.

**Residual architectural limitation:** Instagram can change the request schema between builds or for different accounts; successfully observing one native continuation does not guarantee that a future replay will succeed. The error stop and incomplete state remain mandatory. A fully passive native discovery mode should be evaluated separately if browser-side pagination proves reliable on real target profiles.

## Privacy and error classification

Log only a bounded classification: `kind`, numeric server error `code`, `severity`, and error count. Do **not** copy GraphQL response text, `fbtrace_id`, `mid`, debug links, private usernames, user IDs, request body, `fb_dtsg`, `jazoest`, `lsd`, cookies, access tokens or raw cursors into logs, tests or reports. In-memory Relay contracts remain process-local.

## Test plan and release gates

- Static integrity: JS parser and all prior CI regression suites.
- Mock native initial and continuation requests; accept only correct target; never infer from mismatched target or GraphQL error envelope.
- Mock the script's own fetch transport; verify the observer is not invoked, even when a GraphQL request succeeds.
- Mock a first-page-only request lacking a cursor field and show the completion refuses an invented second page.
- Mock a valid native continuation contract and prove cursor preservation, native provider variables, page cap, end proof and no retry flood.
- Mock dangerous error content and prove summary leaks no message, debug links or tokens.
- Live smoke test with a normal browser session: record that the site actually issues at least one native continuation, see whether the scan reaches an explicit `page_info_end`; check posts, reels and the single-item download UI.
- A recently reinstated Instagram account must not be used for repeated automated experiments. Any checkpoint or rate-limit means stop.

**Release policy:** do not merge this draft into `main` based solely on CI. A native continuation needs to be observed in a real session. A complete, truly reliable end-to-end backup requires further live evidence before any public version bump.
