# v1.5.101 TEST — media-local SOLO floating button: IG Helper reference analysis and actual repair

## Requested behavior (2026-11-11)
User requires a download icon **on or immediately next to the opened Instagram media** (POST, REEL, STORY, etc.), **not merely a panel-only action**. They supplied the full source of **IG Helper v5.4.3**, by SN-Koarashi (GPL-3.0-only), as reference to analyze. Their solo button had never worked, although full backup `@petit._tigre` had 780/780 successful download callbacks; the age-gated Reel `DSzg-mICLxk` has an Instagram “Voir le Reel” warning on both URL variants and had already been archived. Do not re-download it just to test recognition.

## Reference inspection: IG Helper v5.4.3

Independent implementation observed in user-supplied file:
- `createDownloadButton()` finds visible `article` and a foreground-post layout rooted at `<hr>`, inserts a `.button_wrapper` and an `.IG_DW_MAIN` icon adjacent to post controls. A shared `IntersectionObserver` tracks carousel slides.
- `appendReelsButton()` attaches the `.IG_REELS` icon to a Reel container; the route handler recognizes `/<username>/reel/<code>` and `/reels/<code>`.
- `registerPostClickHandlers()` delegates clicks from body-level handlers; `onPageMutations`, `onStoryMutations` and route checks restore UI when React navigates or rerenders.
- `markContainerPositioned()` changes position:relative only when necessary and marks the affected DOM; it also has a restore phase. The reference script uses various layout-specific heuristics and its own media download implementation.
- **No vendor code, CSS or library dependency has been copied.** We retained our own independent icon, download controller, safety barriers, and scripts.

## Concrete weaknesses addressed from our source

Before v1.5.101:
1. `refreshCurrentDownloadButton()` refused to keep a floating icon unless `largestCurrentMedia()` saw a large visible `img/video` **and** `currentMediaOverlayHost()` found a parent with nearly identical geometry. A sensitive-content/age warning can remove/hide video while the URL still identifies the target. The icon vanished without user action.
2. The icon was mounted **inside an Instagram React-owned container** and used local absolute positioning, vulnerable to `overflow:hidden`, stacking contexts and React removal. It could be positioned behind another overlay.
3. `addSingleDownloadButtonToAnchor()` marked anchors with `data-jkl-single-download=1` and immediately returned on subsequent passes. When React removed the sibling button but preserved the anchor/attribute, the script never reinstalled it.
4. The old URL parser omitted Instagram Reel feed deep links `/reels/<shortcode>`, which are used by some individual Reel views.

## v1.5.101 TEST solution

- The opened-media icon `#jkl-current-download` is still a 36×36 px, accessible, click-intercepted button, but is now placed directly under `document.body` with **`position:fixed`** and a high stacking layer. A computed viewport coordinate visually pins it to the active media. This makes it independent of native element nesting, clipping and Instagram's stacking contexts.
- The media rectangle is preferred if a visible video/image exists. If not, `currentMediaRoot()` can resolve a **visible dialog even with zero IMG/VIDEO** (age-gate warning), or a visible post/article or a story section/main viewer. The root must be a visible region of safe size; no arbitrary page-wide button when no media is selected. Full-width main/dialog regions are pinned to a centered plausible media frame. The button avoids the JKL panel when overlapping its rectangle. Scroll and window resize trigger position refresh; the existing URL-only SPA watchdog and MutationObserver persist.
- The original `handleSingleDownloadClick()` window capture handler and `downloadSingleTarget()` pipeline remain unchanged: no invented GraphQL calls, no age-gate bypass, no fake COMPLETE, no concurrent scan/transfer, numeric root ID verified, carousel all-or-nothing, and existing GM_download writing.
- For grid tiles, `addSingleDownloadButtonToAnchor()` now requires a large visible in-viewport permalink tile, not a nested IMG/VIDEO (CSS art is supported). It **checks the actual connected button**, not an obsolete anchor flag; it can reinstall after React removal. Same shared host never gets multiple ambiguous buttons. A floating icon on an opened dialog is not doubled by a grid tile button.
- Accept direct Reel viewer `/reels/<shortcode>` in addition to the previously supported `/reel/<shortcode>` and `/<username>/reel/<shortcode>`. The normalized route remains `reel`; the plain profile tab `/<username>/reels/` remains invalid as a single-media permalink.
- The panel `DOWNLOAD OPEN MEDIA (SOLO)` from v1.5.100 remains as a **secondary fallback**, not a replacement for the media-attached icon.
- No changes to the main scanner, provenance guards, ledger, file naming, download queue, or previously archived 780 media. Production remains at v1.5.78, PR #18 stays DRAFT, parent-folder feature deferred.

## Executable regression evidence

`tests/single-media-floating-regression.test.mjs` executes the real media-root resolver, media selection, overlay geometry, attachment and click path using a simulated age-gate dialog with zero IMG/VIDEO and the actual user Reel PK `3797523949836352612`. It verifies visibility and pinned coordinates, the actual click routing, disabled button during scan, avoidance of the JKL panel, and recreation after a simulated React removal of a media tile button. Tests run without Instagram requests. The historical `tests/single-download-regression.test.mjs` has been updated from the former required parent-host assumption to the new fixed viewport model. A new `/reels/<shortcode>` parsing check is also included indirectly and should be expanded if necessary.

**[CI #42944815738 SUCCESS](https://github.com/JKL93sang/JKL-Instagram-Backup/actions/runs/42944815738)** at tested code-and-tests HEAD `42d014b31e247db15e6747efbe87948b249024da`. Reverify on final documentation HEAD.

## Real browser acceptance (still outstanding)

The code and mocks cannot prove that the precise changing Instagram DOM is compatible on the user's Firefox. After installing v1.5.101 TEST, open one ordinary POST or REEL, and look for the **small floating arrow over the media**, not the old panel button. Click once on one authorized publication that does not require an already-archived file, export `LOGS → EXPORT LOGS (.TXT)`, and inspect:
- `Single download requested: ...`
- `Single download: ... → N file(s)` OR `Single download failed ...`.

Test on the user-supplied age warning Reel **only for visual button presence**; it has already been saved by the 780/780 bulk operation. A real Firefox successful solo download is **not yet confirmed**, and the two missing PROFILE roots 115/117 remain unresolved.
