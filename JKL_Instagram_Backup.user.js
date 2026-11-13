// ==UserScript==
// @name         JKL Instagram Backup
// @namespace    https://jkl.local/
// @version      1.5.112
// @description  TEST v1.5.112: verify an explicit fourth TAGGED child by authenticated same-origin media-info.
// @author       JKL
// @homepageURL  https://github.com/JKL93sang/JKL-Instagram-Backup
// @supportURL   https://github.com/JKL93sang/JKL-Instagram-Backup/issues
// @source       https://github.com/JKL93sang/JKL-Instagram-Backup/blob/fix/tagged-explicit-fourth-child-v1.5.112/JKL_Instagram_Backup.user.js
// @updateURL    https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/fix/tagged-explicit-fourth-child-v1.5.112/JKL_Instagram_Backup.user.js
// @downloadURL  https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/fix/tagged-explicit-fourth-child-v1.5.112/JKL_Instagram_Backup.user.js
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @run-at       document-start
// @sandbox      raw
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      instagram.com
// @connect      www.instagram.com
// @connect      i.instagram.com
// @connect      cdninstagram.com
// @connect      fbcdn.net
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    const APP = Object.freeze({
        NAME: 'JKL Instagram Backup', VERSION: '1.5.112', TZ: 'Europe/Paris',
        DB: 'JKL_IG_BACKUP_DB_V1', SETTINGS: 'JKL_IG_BACKUP_SETTINGS_V1',
        APP_ID: '936619743392459', ASBD_ID: '359341',
        SCROLL_MIN: 3000, SCROLL_MAX: 5500, PROFILE_SCROLL_MIN: 450, PROFILE_SCROLL_MAX: 3200, PROFILE_SCROLL_POLL: 160, PROFILE_MAX_SCROLLS: 200, PROFILE_BOOTSTRAP_MAX_AGE_MS: 20000, REEL_MAX_SCROLLS: 5000, TAGGED_MAX_PAGES: 5000, TAGGED_HYDRATION_LIMIT: 16,
        REEL_SCROLL_MIN: 350, REEL_SCROLL_MAX: 1600, REEL_SCROLL_POLL: 120,
        PAGE_MIN: 650, PAGE_MAX: 1250, SHADOW_PAGE_MIN: 250, SHADOW_PAGE_MAX: 450, SHADOW_MAX_PAGES: 200, DOWNLOAD_DELAY: 0, DOWNLOAD_WORKERS: 1, DOWNLOAD_RETRIES: 3, LEDGER_FLUSH_EVERY: 25, DL_DIAG_SAMPLES: 20, MAX_LOG: 2000, MAX_LOG_ARCHIVE: 50000,
        HYDRATE_MIN: 180, HYDRATE_MAX: 320, HYDRATE_RETRIES: 3, HYDRATE_WORKERS: 4, HYDRATE_LARGE_THRESHOLD: 250, HYDRATE_LARGE_WORKERS: 2, HYDRATE_BULK_THRESHOLD: 100, HYDRATE_BULK_SIZE: 20, HYDRATE_SINGLE_FALLBACK_CAP: 100,
        PROFILE_FALLBACK_DOC: '8363144743749214', TAGGED_FALLBACK_DOC: '28390247837269928',
        HIGHLIGHT_TRAY_FALLBACK_DOC: '26970053832668570',
        STORY_REEL_FALLBACK_DOC: '29184890191114309',
        PUBLIC_GRID_DOC: '27389614800735091',
        PUBLIC_GRID_NAME: 'PolarisLoggedOutDesktopWWWProfilePostsTabContentQuery_connection',
        PRIVATE_PERMALINK_SUFFIX_LENGTH: 28,
        UI_LAYOUT_VERSION: 2,
        PANEL_MARGIN_X: 16,
        PANEL_MARGIN_Y: 12,
        MOBILE_UA: 'Mozilla/5.0 (Linux; Android 10; Pixel 7 XL) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 Chrome/117.0.5938.60 Mobile Safari/537.36 Instagram 307.0.0.34.111',
    });

    const DOWNLOAD_MODE = Object.freeze({
        COMPLETE: 'complete',
        SUBSCRIBER: 'subscriber',
        ACCESSIBLE: 'accessible',
    });
    const PARTIAL_DOWNLOAD_MODES = Object.freeze([
        DOWNLOAD_MODE.SUBSCRIBER,
        DOWNLOAD_MODE.ACCESSIBLE,
    ]);
    const DOWNLOAD_MODE_LABEL = Object.freeze({
        [DOWNLOAD_MODE.COMPLETE]: 'Download batch',
        [DOWNLOAD_MODE.SUBSCRIBER]: 'VERIFIED SUBSCRIBER PARTIAL',
        [DOWNLOAD_MODE.ACCESSIBLE]: 'VERIFIED ACCESSIBLE PARTIAL',
    });

    const GRID_NAMES = new Set([
        'PolarisProfilePostsQuery',
        'PolarisProfilePostsQuery_connection',
        'PolarisProfilePostsTabContentQuery',
        'PolarisProfilePostsTabContentQuery_connection',
    ]);

    const REEL_NAMES = new Set([
        'PolarisProfileReelsTabContentQuery',
        'PolarisProfileReelsTabContentQuery_connection',
    ]);

    const TAGGED_NAMES = new Set([
        'PolarisProfileTaggedTabContentQuery',
        'PolarisProfileTaggedTabContentQuery_connection',
    ]);

    const HIGHLIGHT_TRAY_NAMES = new Set([
        'PolarisProfileStoryHighlightsTrayContentQuery',
        'PolarisProfileStoryHighlightsTrayContentDirectQuery',
    ]);

    const STORY_REEL_NAMES = new Set([
        'PolarisStoriesV3ReelPageStandaloneQuery',
    ]);

    const GRID_CONNECTION_KEY =
        'xdt_api__v1__feed__user_timeline_graphql_connection';

    const REEL_CONNECTION_KEY =
        'xdt_api__v1__clips__user__connection_v2';

    const TAGGED_CONNECTION_KEY =
        'xdt_api__v1__usertags__user_id__feed_connection';

    const HIGHLIGHT_TRAY_CONNECTION_KEY =
        'xdt_api__v1__user_id__paginated_highlights_tray_connection';

    const STORY_REEL_ROOT_KEY =
        'xdt_api__v1__feed__reels_media';

    const RESERVED = new Set([
        'accounts','direct','explore','reels','stories','p','reel','tv',
        'challenge','settings','your_activity','about','legal','web','developer',
    ]);

    const PRIORITY = {
        REEL: 60,
        POST: 50,
        TAGGED: 40,
        HIGHLIGHT: 30,
        STORY: 20,
        AVATAR: 10,
    };

    const HIDDEN_DISCOVERY_SOURCES = new Set([
        'PROFILE_PUBLIC_SHADOW',
        'CONNECTED_HIDDEN_AUTHORIZED',
    ]);

    const DEFAULT_SETTINGS = {
        includePost: true,
        includeReel: true,
        includeStory: true,
        includeHighlight: true,
        includeTagged: true,
        includeAvatar: true,
        force: false,
        debug: false,
    };

    const state = {
        username: '',
        userId: '',
        profile: null,
        profileInfo: null,
        expected: 0,

        exclusive: {
            known: false,
            hasExclusiveFeedContent: false,
            fanClubId: '',
            subscriberCount: null,
            autosaveExclusiveHighlight: false,
            postsStatus: '',
            reelsStatus: '',
            storiesStatus: '',
            liveStatus: '',
        },

        coverage: {
            profileGrid: false,
            publicShadow: false,
            connectedHidden: false,
            reels: false,
            ownedHydration: false,
            tagged: false,
            highlights: false,
            story: false,
            avatar: false,
        },

        hidden: {
            pages: 0,
            candidates: 0,
            alreadyOwned: 0,
            recovered: 0,
            previewOnly: 0,
            failed: 0,
            recoveredCodes: [],
        },

        shadow: {
            applicable: true,
            reason: '',
            totalRoots: 0,
            postRoots: 0,
            extras: 0,
            pages: 0,
            profileId: '',
            pageInfoEnded: false,
            rootIds: new Set(),
            postIds: new Set(),
            reelIds: new Set(),
            reelsEvidence: null,
        },

        hydration: {
            totalRoots: 0,
            hydratedRoots: 0,
            diskSatisfiedRoots: 0,
            failedRoots: 0,
            filesBefore: 0,
            filesAfter: 0,
        },

        // Read-only PROFILE provenance snapshots; never grant coverage.
        profileMainGridRootIds: new Set(),
        profileDomObservedRootIds: new Set(),
        verifiedProfileDomApiRootIds: new Set(), // strict same-owner POST media-info, never DOM alone
        rootCatalog: new Map(),
        highlightCatalog: new Map(), // Instagram reel ID -> stable archive folder
        highlightRenameNotices: new Set(),
        queue: new Map(),

        // Authorized only after full authenticated media-info, never previews.
        verifiedSubscriberRootIds: new Set(),
        // Individual Reel units from already-observed, target-bound native
        // Web responses. This is never proof of full REELS pagination.
        verifiedPassiveReelRootIds: new Set(),
        // Fully resolved media in a genuine, target-bound native PROFILE
        // response may be saved individually even when PROFILE pagination
        // has not reached a proven server end. Never a full-grid proof.
        verifiedPassiveProfilePostRootIds: new Set(),
        partialDownloadGrants: { subscriber: null, accessible: null },

        roots: {
            POST: new Set(),
            REEL: new Set(),
            TAGGED: new Set(),
            STORY: new Set(),
            HIGHLIGHT: new Set(),
            AVATAR: new Set(),
        },

        running: false,
        downloading: false,
        cancelled: false,
        feedbackRequired: false,
        feedbackMessage: '',
        rateLimited: false,
        rateLimitMessage: '',
        apiUnhealthy: false,
        apiUnhealthyMessage: '',

        /*
         * The queue is downloadable only when it comes from a scan that was
         * conclusively COMPLETE with the exact category selection snapshotted
         * at scan start. UI changes after the scan cannot alter this verdict.
         */
        scanPlan: null,
        scanComplete: false,
        scanOutcome: 'NONE',
        // Diagnostic only. Never authorizes COMPLETE or full download.
        reelsDiagnosis: {kind:'NOT_SCANNED', reason:'', source:''},
        scanUserId: '',
        scanQueueSize: 0,
        scanQueueFingerprint: '',

        progress: {
            order: [],
            current: '',
            phases: {},
        },

        downloadProgress: {
            status: 'idle',
            total: 0,
            completed: 0,
            succeeded: 0,
            failed: 0,
            blocked: 0,
            current: '',
        },

        dbCache: null,
        ledgerDirty: 0,

        settings: loadSettings(),

        diskActive: false,
        diskCanonical: new Set(),
        diskCanonicalMeta: new Map(),
        diskLocations: new Map(),
        diskPaths: new Map(), // verified relative paths from SCAN LOCAL FOLDER
        sessionPaths: new Map(), // paths requested by successful downloads
        sessionCategories: new Map(), // GM_download callbacks, NOT indexed file evidence
        diskIndexStats: {
            selectedFiles: 0,
            canonicalFiles: 0,
            legacyFiles: 0,
            unrecognizedFiles: 0,
        },
        diskHidden: new Set(),
        diskStoryHighlight: new Set(),
        legacy: new Map(),


        downloaded: 0,
        failed: 0,
    };

    const net = {
        nativeFetch: null,

        gridByUser: new Map(),
        gridPageInfo: new Map(),
        gridDocByUser: new Map(),
        gridQueryByUser: new Map(),
        gridNativeAuditByUser: new Map(),
        gridNativeContinuationByUser: new Map(),
        gridNativeInitialByUser: new Map(),
        gridCaptureSeenAtByUser: new Map(),
        gridBootstrapConsumedByUser: new Set(),

        reelsByUserId: new Map(),
        reelPageInfo: new Map(),
        reelNativeAuditByUserId: new Map(),
        reelNativeInitialByUserId: new Map(),
        reelNativeContinuationByUserId: new Map(),
        reelCaptureSeenAtByUserId: new Map(),
        reelBootstrapConsumedByUserId: new Set(),

        taggedDocInitial: '',
        taggedDocConnection: '',
        taggedNativeVariables: null,
        taggedInitialData: null,
        taggedInitialUserId: '',
        // Authentic native TAGGED first pages, isolated by requested user ID.
        taggedNativeByUserId: new Map(),
        taggedBootstrapConsumedByUserId: new Set(),

        relayFbDtsg: '',
        relayLsd: '',
        relayJazoest: '',
        relayBloksVersionId: '',
        relayTemplates: {
            api: null,
            query: null,
        },

        highlightTrayDoc: '',
        highlightTrayFriendly: '',
        highlightTrayVariables: null,
        highlightTrayEndpoint: '',
        highlightTrayData: null,
        highlightTrayUserId: '',

        storyReelDoc: '',
    };

    let ui = {};

    // DOM log rendering has a bounded cost; the export keeps a separate,
    // much larger chronological record for the current page session.
    // The archive never persists credentials or performs network requests.
    const logArchive = {
        startedAt: new Date(),
        entries: [],
        dropped: 0,
        accounts: new Set(),
    };

    const UI_STATE_KEY = 'JKL_IG_BACKUP_UI_V1';

    const singleDownloadState = {
        busy: new Set(),
        observer: null,
        timer: 0,
        eventsInstalled: false,
        lastOverlayDiagnostic: '',
        lastLocation: '',
        locationTimer: 0,
    };

    function cleanUser(v) {
        return String(v || '')
            .trim()
            .replace(/^@/, '')
            .replace(/[^A-Za-z0-9._]/g, '');
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function rand(a, b) {
        return a + Math.floor(Math.random() * (b - a + 1));
    }

    // Unified preflight for all requests CREATED by this userscript,
    // regardless of whether they use GM transport or nativeFetch.
    // Never replay a private-mobile REST POST from a desktop Web session.
    function unsafePrivateRestMethod(url, method = 'GET') {
        let endpoint;
        try {
            endpoint = new URL(String(url || ''), 'https://www.instagram.com');
        }
        catch { return null; }

        if (
            /^(?:www|i)\.instagram\.com$/i.test(endpoint.hostname) &&
            endpoint.pathname.startsWith('/api/v1/') &&
            String(method || 'GET').toUpperCase() !== 'GET'
        ) {
            const error = new Error(
                'Unsafe private-mobile API method blocked before dispatch.'
            );
            error.code = 'IG_UNSUPPORTED_TRANSPORT';
            return error;
        }
        return null;
    }

    // A CDN media failure is NOT evidence that the Instagram API session
    // is invalid. Keep account/session circuit breakers scoped to the
    // instagram.com origin (and 401 checks only to API/GraphQL paths).
    // Never decide by Content-Type alone: CDN error payloads may be JSON.
    function instagramRequestScope(url) {
        try {
            const u = new URL(String(url || ''));
            const host = u.hostname.toLowerCase();
            const instagramOrigin = host === 'instagram.com' ||
                host.endsWith('.instagram.com');
            const api = instagramOrigin && (
                u.pathname.startsWith('/api/') ||
                u.pathname.startsWith('/graphql')
            );
            return {instagramOrigin, api};
        }
        catch {
            return {instagramOrigin:false, api:false};
        }
    }

    function gmRequest(options) {
        // Bound GM transports to two concurrent in-flight requests.
        // Any pending work is rejected after an Instagram safety circuit.
        const gate = gmRequest._gate ||
            (gmRequest._gate = { active:0, pending:[] });
        const stopError = () => {
            if (state.feedbackRequired) {
                return feedbackCircuitBreak(state.feedbackMessage);
            }
            if (state.rateLimited) {
                return rateLimitCircuitBreak(state.rateLimitMessage);
            }
            if (state.apiUnhealthy) {
                return apiUnhealthyError(state.apiUnhealthyMessage);
            }
            if (state.cancelled && state.running) {
                return new Error('Cancelled');
            }
            return null;
        };
        const pump = () => {
            while (gate.active < 2 && gate.pending.length) {
                const task = gate.pending.shift();
                const denied = stopError();
                if (denied) {
                    task.reject(denied);
                    continue;
                }
                gate.active++;
                task.start();
            }
            const stopped = stopError();
            if (stopped) {
                for (const task of gate.pending.splice(0)) {
                    task.reject(stopped);
                }
            }
        };

        return new Promise((resolve, reject) => {
            // Workers can settle asynchronously after a fatal server reply.
            // No further GM requests are allowed once the session circuit trips.
            if (state.feedbackRequired) {
                reject(feedbackCircuitBreak(state.feedbackMessage));
                return;
            }
            if (state.rateLimited) {
                reject(rateLimitCircuitBreak(state.rateLimitMessage));
                return;
            }
            if (state.apiUnhealthy) {
                reject(apiUnhealthyError(state.apiUnhealthyMessage));
                return;
            }
            if (state.cancelled && state.running) {
                reject(new Error('Cancelled'));
                return;
            }
            if (typeof GM_xmlhttpRequest !== 'function') {
                reject(new Error('GM_xmlhttpRequest unavailable'));
                return;
            }

            const request = {
                ...(options || {}),
            };

            const feedbackLabel = String(
                request.feedbackLabel ||
                'Instagram request'
            );

            const feedbackCheck =
                request.feedbackCheck !== false;

            delete request.feedbackLabel;
            delete request.feedbackCheck;

            const denied = unsafePrivateRestMethod(request.url, request.method);
            if (denied) {
                reject(denied);
                return;
            }

            gate.pending.push({
                reject,
                start: () => {
                    let finished = false;
                    const finish = (error, response) => {
                        if (finished) return;
                        finished = true;
                        gate.active = Math.max(0, gate.active - 1);
                        if (error) reject(error);
                        else resolve(response);
                        pump();
                    };
                    try {
                        const stopped = stopError();
                        if (stopped) {
                            finish(stopped);
                            return;
                        }
                        GM_xmlhttpRequest({
                timeout: 30000,
                ...request,
                onload: response => {
                    const scope = instagramRequestScope(request.url);

                    const payload =
                        typeof response?.responseText === 'string'
                            ? response.responseText
                            : (
                                typeof response?.response === 'string' ||
                                (
                                    response?.response &&
                                    typeof response.response === 'object' &&
                                    !(response.response instanceof ArrayBuffer)
                                )
                            )
                                ? response.response
                                : null;

                    if (
                        feedbackCheck &&
                        Number(response?.status || 0) === 429 &&
                        scope.instagramOrigin
                    ) {
                        finish(rateLimitCircuitBreak(
                            `${feedbackLabel}: Instagram returned HTTP 429.`
                        ));
                        return;
                    }

                    if (
                        feedbackCheck &&
                        scope.api &&
                        Number(response?.status || 0) === 401
                    ) {
                        finish(apiUnhealthyError(
                            `${feedbackLabel}: Instagram API returned HTTP 401; authenticated session cannot be trusted.`
                        ));
                        return;
                    }

                    if (
                        feedbackCheck &&
                        scope.api &&
                        feedbackRequiredIn(payload)
                    ) {
                        finish(feedbackCircuitBreak(
                            `${feedbackLabel}: Instagram returned feedback_required.`
                        ));
                        return;
                    }

                    if (
                        feedbackCheck &&
                        scope.api &&
                        instagramAuthChallengeIn(payload)
                    ) {
                        finish(apiUnhealthyError(
                            `${feedbackLabel}: Instagram authentication/checkpoint required; stopping requests.`
                        ));
                        return;
                    }

                    finish(null, response);
                },
                onerror: response => {
                    const status = Number(response?.status || 0);
                    const message = String(
                        response?.error ||
                        response?.details ||
                        response?.statusText ||
                        (status
                            ? `GM request failed (HTTP ${status})`
                            : 'GM request failed')
                    );

                    const e = new Error(message);
                    e.status = status;
                    // Some GM implementations report a denied HTTP response
                    // through onerror, not onload. Apply the same hard stop
                    // semantics in BOTH transport callback paths.
                    const scope = instagramRequestScope(request.url);
                    if (scope.instagramOrigin && status === 429) {
                        finish(rateLimitCircuitBreak(
                            `${feedbackLabel}: Instagram returned HTTP 429.`
                        ));
                        return;
                    }
                    const body = response?.responseText ?? response?.response;
                    if (scope.instagramOrigin && feedbackRequiredIn(body)) {
                        finish(feedbackCircuitBreak(
                            `${feedbackLabel}: Instagram returned feedback_required.`
                        ));
                        return;
                    }
                    if (scope.api && (status === 401 || instagramAuthChallengeIn(body))) {
                        finish(apiUnhealthyError(
                            `${feedbackLabel}: Instagram authentication/checkpoint required; stopping requests.`
                        ));
                        return;
                    }
                    finish(e);
                },
                ontimeout: () => {
                    const e = new Error('GM request timeout');
                    e.code = 'GM_TIMEOUT';
                    finish(e);
                },
                onabort: () => {
                    const e = new Error('GM request aborted');
                    e.code = 'GM_ABORTED';
                    finish(e);
                },
            });
                    } catch (error) {
                        finish(error);
                    }
                },
            });
            pump();
        });
    }

    // Inspect only protocol-level error controls, not arbitrary captions,
    // comments, filenames or media metadata that might contain this token.
    function feedbackRequiredIn(value) {
        if (value == null) return false;
        let data = value;
        if (typeof data === 'string') {
            const raw = data.trim();
            if (/^feedback_required$/i.test(raw) ||
                /^Instagram returned feedback_required\.?$/i.test(raw)) {
                return true;
            }
            try { data = JSON.parse(raw); }
            catch { return false; }
        }
        if (!data || typeof data !== 'object') return false;

        const controls = [data];
        if (data.error && typeof data.error === 'object') {
            controls.push(data.error);
        }
        if (Array.isArray(data.errors)) {
            controls.push(...data.errors.filter(e =>
                e && typeof e === 'object'
            ));
        }
        const matches = v => typeof v === 'string' &&
            /(?:^|[\s.:])feedback_required(?:$|[\s.:])/i.test(v.trim());
        return controls.some(x =>
            [x.message,x.error_type,x.type,x.code,x.error].some(matches)
        );
    }

    // Only inspect server control fields. Do not search arbitrary text
    // (captions or comments can contain words such as "login_required").
    // This protects against continuing after an authentication challenge.
    function instagramAuthChallengeIn(value) {
        let data = value;
        if (typeof value === 'string') {
            try { data = JSON.parse(value); }
            catch { return false; }
        }
        if (!data || typeof data !== 'object') return false;
        const controls = [data];
        if (data.error && typeof data.error === 'object') {
            controls.push(data.error);
        }
        if (Array.isArray(data.errors)) {
            controls.push(...data.errors.filter(x =>
                x && typeof x === 'object'
            ));
        }
        const denied = /^(?:login_required|challenge_required|checkpoint_required|checkpoint_challenge_required|consent_required|user_has_logged_out)$/i;
        return controls.some(x =>
            [x.message, x.error_type, x.type, x.code].some(
                v => typeof v === 'string' && denied.test(v.trim())
            )
        );
    }

    function feedbackCircuitBreak(message) {
        const msg = String(
            message ||
            state.feedbackMessage ||
            'Instagram returned feedback_required.'
        );

        if (!state.feedbackRequired) {
            state.feedbackRequired = true;
            state.feedbackMessage = msg;
        }

        state.cancelled = true;
        state.scanComplete = false;

        if (state.running) {
            state.scanOutcome = 'FEEDBACK_REQUIRED';
        }

        const e = new Error(
            state.feedbackMessage || msg
        );
        e.code = 'IG_FEEDBACK_REQUIRED';
        return e;
    }

    function rateLimitCircuitBreak(message) {
        const msg = String(
            message ||
            state.rateLimitMessage ||
            'Instagram returned HTTP 429 (rate limited).'
        );

        if (!state.rateLimited) {
            state.rateLimited = true;
            state.rateLimitMessage = msg;
        }

        state.cancelled = true;
        state.scanComplete = false;

        if (state.running) {
            state.scanOutcome = 'RATE_LIMITED';
        }

        const e = new Error(
            state.rateLimitMessage || msg
        );
        e.code = 'IG_RATE_LIMITED';
        e.status = 429;
        return e;
    }

    function apiUnhealthyError(message) {
        const msg = String(
            message ||
            state.apiUnhealthyMessage ||
            'Instagram API returned an invalid protocol response.'
        );

        if (!state.apiUnhealthy) {
            state.apiUnhealthy = true;
            state.apiUnhealthyMessage = msg;
        }

        state.cancelled = true;
        state.scanComplete = false;

        if (state.running) {
            state.scanOutcome = 'API_UNHEALTHY';
        }

        const e = new Error(state.apiUnhealthyMessage || msg);
        e.code = 'IG_API_UNHEALTHY';
        return e;
    }

    function throwIfInstagramStop(e, context = '') {
        if (e?.code === 'IG_API_UNHEALTHY' || state.apiUnhealthy) {
            throw apiUnhealthyError(
                state.apiUnhealthyMessage || e?.message
            );
        }

        const cleanContext = String(context || '')
            .replace(/:\s*Instagram returned feedback_required\.?$/i, '')
            .replace(/:\s*Instagram returned HTTP 429\.?$/i, '')
            .trim();

        if (
            e?.code === 'IG_FEEDBACK_REQUIRED' ||
            state.feedbackRequired ||
            feedbackRequiredIn(e?.message)
        ) {
            throw feedbackCircuitBreak(
                cleanContext
                    ? `${cleanContext}: Instagram returned feedback_required.`
                    : (state.feedbackMessage || e?.message)
            );
        }

        if (
            e?.code === 'IG_RATE_LIMITED' ||
            state.rateLimited ||
            Number(e?.status || 0) === 429
        ) {
            throw rateLimitCircuitBreak(
                cleanContext
                    ? `${cleanContext}: Instagram returned HTTP 429.`
                    : (state.rateLimitMessage || e?.message)
            );
        }
    }

    function currentScanSelection() {
        return {
            post: !!ui.cbPost?.checked,
            reel: !!ui.cbReel?.checked,
            tagged: !!ui.cbTagged?.checked,
            highlight: !!ui.cbHighlight?.checked,
            story: !!ui.cbStory?.checked,
            avatar: !!ui.cbAvatar?.checked,
        };
    }

    function scanSelection() {
        return state.scanPlan || currentScanSelection();
    }

    function scanSelected(key) {
        return !!scanSelection()?.[key];
    }

    function scanPhasePlan(plan = currentScanSelection()) {
        const p = plan || {};
        const out = ['PROFILE INFO'];

        if (p.post || p.reel) out.push('PROFILE GRID');
        if (p.post) out.push('PUBLIC SHADOW');
        if (p.post || p.reel) out.push('CONNECTED HIDDEN');
        if (p.reel) out.push('REELS');
        if (p.tagged) out.push('TAGGED');
        if (p.highlight) out.push('HIGHLIGHTS');
        if (p.story) out.push('STORY');
        if (p.avatar) out.push('AVATAR');
        if (p.post || p.reel) out.push('DEEP HYDRATION');

        return out;
    }

    function resetScanProgress(plan = currentScanSelection()) {
        const order = scanPhasePlan(plan);
        const phases = {};

        for (const label of order) {
            phases[label] = {
                status: 'pending',
                current: 0,
                total: 0,
                detail: '',
            };
        }

        state.progress = {
            order,
            current: '',
            phases,
        };
    }

    function beginScanProgressPhase(label) {
        const phase = state.progress?.phases?.[label];
        if (!phase) return;

        phase.status = 'running';
        phase.current = 0;
        phase.total = 0;
        phase.detail = '';
        state.progress.current = label;
        updateStats();
    }

    function setScanProgressPhase(label, current, total, detail = '') {
        const phase = state.progress?.phases?.[label];
        if (!phase) return;

        const nTotal = Math.max(0, Number(total) || 0);
        const nCurrent = Math.max(0, Number(current) || 0);

        phase.status = 'running';
        phase.total = nTotal;
        phase.current = nTotal > 0
            ? Math.min(nCurrent, nTotal)
            : nCurrent;
        phase.detail = String(detail || '');
        state.progress.current = label;
        updateStats();
    }

    function finishScanProgressPhase(label, failed = false) {
        const phase = state.progress?.phases?.[label];
        if (!phase) return;

        phase.status = failed ? 'error' : 'done';

        if (!failed && phase.total > 0) {
            phase.current = phase.total;
        }

        if (state.progress.current === label) {
            state.progress.current = failed ? label : '';
        }

        updateStats();
    }

    function scanProgressSummary() {
        const order = Array.isArray(state.progress?.order)
            ? state.progress.order
            : [];

        if (!order.length) {
            return {
                ratio: 0,
                percent: 0,
                completed: 0,
                total: 0,
                current: '',
                currentText: 'Ready',
                indeterminate: false,
            };
        }

        let units = 0;
        let completed = 0;
        let current = '';

        for (const label of order) {
            const phase = state.progress?.phases?.[label];
            if (!phase) continue;

            if (phase.status === 'done') {
                units += 1;
                completed++;
                continue;
            }

            if (phase.status === 'running' || phase.status === 'error') {
                current ||= label;

                if (phase.total > 0) {
                    units += Math.min(
                        1,
                        Math.max(0, phase.current / phase.total)
                    );
                }
            }
        }

        const ratio = Math.min(
            1,
            Math.max(0, units / order.length)
        );

        const running = current
            ? state.progress.phases[current]
            : null;

        let currentText = 'Ready';

        if (!state.running && state.scanOutcome === 'EXPOSED_COMPLETE') {
            currentText = 'Finished · EXPOSED SOURCES COMPLETE';
        }
        else if (!state.running && state.scanOutcome === 'COMPLETE') {
            currentText = 'Finished · COMPLETE';
        }
        else if (!state.running && state.scanOutcome === 'INCOMPLETE') {
            currentText = 'Finished · INCOMPLETE';
        }
        else if (
            !state.running &&
            state.scanOutcome &&
            !['NONE', 'RUNNING'].includes(state.scanOutcome)
        ) {
            currentText = `Stopped · ${state.scanOutcome}`;
        }
        else if (current && running) {
            currentText = current;

            if (running.total > 0) {
                currentText += ` · ${Math.min(running.current, running.total)}/${running.total}`;
            }

            if (running.detail) {
                currentText += ` · ${running.detail}`;
            }
        }
        else if (completed > 0) {
            currentText = `${completed}/${order.length} phases complete`;
        }

        return {
            ratio,
            percent: Math.round(ratio * 1000) / 10,
            completed,
            total: order.length,
            current,
            currentText,
            indeterminate: !!(
                current &&
                running &&
                running.status === 'running' &&
                !(running.total > 0)
            ),
        };
    }


    function currentPhaseSummary() {
        const current = String(
            state.progress?.current ||
            ''
        );

        const phase = current
            ? state.progress?.phases?.[current]
            : null;

        if (!state.running || !current || !phase) {
            if (state.scanOutcome === 'EXPOSED_COMPLETE') {
                return {
                    label: 'EXPOSED SCAN COMPLETE',
                    percent: 100,
                    value: '100%',
                    detail: 'Visible sources verified · REELS tab absent/skipped',
                    indeterminate: false,
                };
            }

            if (state.scanOutcome === 'COMPLETE') {
                return {
                    label: 'SCAN COMPLETE',
                    percent: 100,
                    value: '100%',
                    detail: 'All selected phases processed',
                    indeterminate: false,
                };
            }

            if (state.scanOutcome === 'INCOMPLETE') {
                return {
                    label: 'SCAN FINISHED',
                    percent: 100,
                    value: '100%',
                    detail: 'Work processed · coverage INCOMPLETE',
                    indeterminate: false,
                };
            }

            return {
                label: 'CURRENT PHASE',
                percent: 0,
                value: '—',
                detail: 'Idle',
                indeterminate: false,
            };
        }

        const labels = {
            'PROFILE INFO': 'PROFILE INFO',
            'PROFILE GRID': 'PROFILE GRID · POST + REEL',
            'PUBLIC SHADOW': 'PUBLIC SHADOW',
            'CONNECTED HIDDEN': 'CONNECTED HIDDEN',
            'REELS': 'REELS',
            'TAGGED': 'TAGGED',
            'HIGHLIGHTS': 'HIGHLIGHTS',
            'STORY': 'STORY',
            'AVATAR': 'AVATAR',
            'DEEP HYDRATION': 'DEEP HYDRATION',
        };

        const total = Math.max(
            0,
            Number(phase.total || 0)
        );

        const currentUnits = Math.max(
            0,
            Number(phase.current || 0)
        );

        const hasTotal = total > 0;
        const ratio = hasTotal
            ? Math.min(1, currentUnits / total)
            : 0;

        let detail = String(phase.detail || '');

        if (!detail) {
            if (current === 'PROFILE GRID') {
                detail =
                    `${state.roots.POST.size} posts · ` +
                    `${state.roots.REEL.size} reels discovered`;
            }
            else if (current === 'REELS') {
                detail = `${state.roots.REEL.size} reel roots discovered`;
            }
            else if (current === 'TAGGED') {
                detail = `${state.roots.TAGGED.size} tagged roots discovered`;
            }
            else if (current === 'STORY') {
                detail = `${state.roots.STORY.size} story items discovered`;
            }
            else if (current === 'AVATAR') {
                detail = `${state.roots.AVATAR.size} avatar item discovered`;
            }
            else {
                detail = 'Working…';
            }
        }

        return {
            label: labels[current] || current,
            percent: Math.round(ratio * 1000) / 10,
            value: hasTotal
                ? `${Math.min(currentUnits, total)}/${total}`
                : '…',
            detail,
            indeterminate: !hasTotal,
        };
    }

    function downloadOperationPlan(mediaList = state.queue.values()) {
        let main = 0;

        for (const m of mediaList) {
            if (!existingReason(m)) {
                main++;
            }
        }

        return {
            main,
            hidden: 0,
            total: main,
        };
    }

    function resetDownloadProgress(status = 'idle') {
        state.downloadProgress = {
            status,
            total: 0,
            completed: 0,
            succeeded: 0,
            failed: 0,
            blocked: 0,
            current: '',
        };
    }

    function beginDownloadProgress(mediaList) {
        const plan =
            downloadOperationPlan(mediaList);

        state.downloadProgress = {
            status: plan.total > 0
                ? 'running'
                : 'complete',
            total: plan.total,
            completed: 0,
            succeeded: 0,
            failed: 0,
            blocked: 0,
            current: '',
        };

        updateStats();
        return plan;
    }

    function markDownloadOperation(
        ok,
        m,
        kind,
        { blocked = false } = {}
    ) {
        const p = state.downloadProgress;

        if (p?.status !== 'running') {
            return;
        }

        p.completed = Math.min(
            p.total,
            p.completed + 1
        );

        if (blocked) {
            p.blocked++;
        }
        else if (ok) {
            p.succeeded++;
        }
        else {
            p.failed++;
        }

        p.current =
            `${kind} · ${m?.filename || m?.id || 'media'}`;
    }

    function clearPartialDownloadGrants() {
        for (const mode of PARTIAL_DOWNLOAD_MODES) {
            state.partialDownloadGrants[mode] = null;
        }
    }

    function invalidateCompletedScan(reason = 'SCAN_INVALIDATED') {
        if (!state.scanPlan) {
            return;
        }

        state.scanComplete = false;
        state.scanOutcome = reason;
        state.scanUserId = '';
        state.scanQueueSize = 0;
        state.scanQueueFingerprint = '';
        clearPartialDownloadGrants();
    }

    function resetCoverage() {
        for (const key of Object.keys(state.coverage)) {
            state.coverage[key] = false;
        }
        state.reelsDiagnosis = {kind:'NOT_SCANNED', reason:'', source:''};

        state.shadow.applicable = true;
        state.shadow.reason = '';
        state.shadow.totalRoots = 0;
        state.shadow.postRoots = 0;
        state.shadow.extras = 0;
        state.shadow.pages = 0;
        state.shadow.profileId = '';
        state.shadow.pageInfoEnded = false;
        state.shadow.rootIds = new Set();
        state.shadow.postIds = new Set();
        state.shadow.reelIds = new Set();
        state.shadow.reelsEvidence = null;

        state.hidden.pages = 0;
        state.hidden.candidates = 0;
        state.hidden.alreadyOwned = 0;
        state.hidden.recovered = 0;
        state.hidden.previewOnly = 0;
        state.hidden.failed = 0;
        state.hidden.recoveredCodes = [];
        state.verifiedSubscriberRootIds.clear();
        state.verifiedPassiveReelRootIds.clear();
        state.verifiedPassiveProfilePostRootIds?.clear?.();
        state.verifiedProfileDomApiRootIds?.clear?.();
        state.highlightCatalog.clear();
        state.highlightRenameNotices.clear();
        clearPartialDownloadGrants();

        state.hydration.totalRoots = 0;
        state.hydration.hydratedRoots = 0;
        state.hydration.diskSatisfiedRoots = 0;
        state.hydration.failedRoots = 0;
        state.hydration.filesBefore = 0;
        state.hydration.filesAfter = 0;
    }

    function requiredCoverage(plan = scanSelection()) {
        const out = [];

        if (plan?.post) {
            out.push(['PROFILE grid', 'profileGrid']);
            out.push(['PUBLIC shadow', 'publicShadow']);
        }

        if (plan?.post || plan?.reel) {
            out.push(['CONNECTED hidden candidates', 'connectedHidden']);
        }

        if (plan?.reel) {
            out.push(['REELS tab', 'reels']);
        }

        if (plan?.post || plan?.reel) {
            out.push(['OWNED hydration', 'ownedHydration']);
        }

        if (plan?.tagged) {
            out.push(['TAGGED', 'tagged']);
        }

        if (plan?.highlight) {
            out.push(['HIGHLIGHT', 'highlights']);
        }

        if (plan?.story) {
            out.push(['STORY', 'story']);
        }

        if (plan?.avatar) {
            out.push(['AVATAR', 'avatar']);
        }

        return out;
    }

    // A verified absence of a native REELS navigation surface should not
    // block downloading OTHER fully scanned categories. This is an operational
    // skip, NEVER a claim of server-confirmed zero clips or a full archive.
    // Classifier NOT_EXPOSED is issued only after the public grid, connected
    // hidden and owned hydration pass, with no positive Reel evidence.
    function reelsSurfaceSkipped() {
        // Operational skip for a truly absent tab, not proof of zero clips.
        // Do not authorize a full exposed-surface scan if the user-info
        // response belongs to a different Instagram account.
        const apiUserId = String(
            state.profileInfo?.pk || state.profileInfo?.id || ''
        ).split('_')[0];
        return scanSelected('reel') &&
            !!apiUserId &&
            apiUserId === String(state.userId || '') &&
            state.coverage.reels !== true &&
            state.reelsDiagnosis?.kind === 'NOT_EXPOSED' &&
            state.coverage.profileGrid === true &&
            state.coverage.connectedHidden === true &&
            state.coverage.ownedHydration === true &&
            state.roots.REEL.size === 0 &&
            state.shadow.reelIds.size === 0;
    }

    // Operational result only: preserve coverage.profileGrid=false when
    // Instagram never exposes the native main-grid server end. An exposed
    // archive can nevertheless be finished if every discovered file is
    // independently source-verified, the anonymous/public and browser-native
    // root union matches the authenticated main-grid counter, and every
    // other requested surface has completed. Never call this a full archive.
    function profileSurfaceOperationalSkip() {
        if (!scanSelected('post') || !scanSelected('reel') ||
            state.coverage.profileGrid === true ||
            !profilePublicGapAvoidsSyntheticRelay() ||
            !state.exclusive?.known ||
            state.exclusive.hasExclusiveFeedContent === true ||
            state.cancelled || state.feedbackRequired ||
            state.rateLimited || state.apiUnhealthy ||
            !state.scanPlan || !state.userId || !state.username ||
            !(state.queue instanceof Map) || !state.queue.size ||
            !requiredCoverage().every(([,key]) =>
                key === 'profileGrid' || state.coverage[key] === true)
        ) return false;

        // Subscriber/hidden media need their own complete archive proof;
        // never let an exposed/public skip silently expand their scope.
        if (!state.hidden || state.hidden.candidates !== 0 ||
            state.hidden.recovered !== 0 ||
            state.hidden.previewOnly !== 0 ||
            state.hidden.failed !== 0) return false;

        const expected = Number(state.expected);
        const authenticatedCount = Number(state.profileInfo?.media_count);
        if (!Number.isSafeInteger(expected) || expected < 1 ||
            expected !== authenticatedCount) return false;

        const key = String(state.username).toLowerCase();
        const native = net.gridByUser?.get(key);
        const audit = net.gridNativeAuditByUser?.get(key);
        const session = state.nativeProfileEvidenceSession;
        const observedAt = net.gridCaptureSeenAtByUser?.get(key);
        const publicRoots = state.shadow?.rootIds;
        const recorded = ownedIds();
        if (!(native instanceof Map) || !native.size ||
            !(publicRoots instanceof Set) || !publicRoots.size ||
            !audit || (audit.initial || 0) + (audit.continuation || 0) < 1 ||
            !session || session.key !== key ||
            session.userId !== String(state.userId) ||
            !Number.isFinite(session.acceptedAt) ||
            !Number.isFinite(observedAt) ||
            (observedAt !== session.acceptedCapturedAt &&
                observedAt < session.acceptedAt)) return false;

        const union = new Set(publicRoots);
        let overlap = 0;
        for (const id of native.keys()) {
            if (!/^\d+$/.test(id)) return false;
            if (publicRoots.has(id)) overlap++;
            union.add(id);
        }
        if (!overlap || union.size !== expected ||
            [...union].some(id => !/^\d+$/.test(id) ||
                !recorded.has(id))) return false;

        // The existing strict per-file proof is stronger than a counter.
        // Any queue entry lacking its own authorized source, root, or
        // hydration must retain the old INCOMPLETE+PARTIAL behaviour.
        const verified = verifiedAccessibleMedia();
        const authorizedIds = new Set(verified.map(m => String(m.id)));
        return verified.length === state.queue.size &&
            authorizedIds.size === state.queue.size &&
            [...state.queue.keys()].every(id => authorizedIds.has(String(id)));
    }

    function incompleteCoverage() {
        return requiredCoverage()
            .filter(([, key]) => !state.coverage[key] &&
                !(key === 'reels' && reelsSurfaceSkipped()) &&
                !(key === 'profileGrid' && profileSurfaceOperationalSkip()))
            .map(([label]) => label);
    }

    function globalGap() {
        if (!state.expected) {
            return 0;
        }

        return Math.max(0, state.expected - ownedCount());
    }

    function pathNorm(p) {
        const s = String(p || '/')
            .replace(/\/+/g, '/')
            .replace(/\/+$/, '');

        return s || '/';
    }

    function currentProfile() {
        const p = location.pathname
            .split('/')
            .filter(Boolean);

        if (
            p.length === 1 &&
            !RESERVED.has(p[0].toLowerCase())
        ) {
            return cleanUser(p[0]);
        }

        if (
            p.length >= 2 &&
            ['reels', 'tagged'].includes(p[1].toLowerCase()) &&
            !RESERVED.has(p[0].toLowerCase())
        ) {
            return cleanUser(p[0]);
        }

        return '';
    }

    function sanitize(v) {
        return String(v || '')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/[\u0000-\u001F]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[. ]+$/g, '') || 'UNKNOWN';
    }

    function sanitizePathComponent(
        value,
        fallback = 'UNKNOWN',
        maxLength = 96
    ) {
        let out =
            String(
                value ||
                ''
            );

        try {
            out =
                out.normalize(
                    'NFKC'
                );
        }
        catch {}

        out = out
            .replace(
                /[\u0000-\u001F\u007F-\u009F]/g,
                ''
            )
            .replace(
                /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
                ''
            )
            .replace(
                /[<>:"/\\|?*]/g,
                '_'
            )
            .replace(
                /\s+/g,
                ' '
            )
            .trim()
            .replace(
                /[. ]+$/g,
                ''
            );

        if (!out) {
            out =
                String(
                    fallback ||
                    'UNKNOWN'
                );
        }

        if (
            /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(
                out
            )
        ) {
            out =
                `_${out}`;
        }

        if (
            Number.isFinite(
                Number(maxLength)
            ) &&
            Number(maxLength) > 0
        ) {
            out =
                Array.from(out)
                    .slice(
                        0,
                        Number(maxLength)
                    )
                    .join('')
                    .replace(
                        /[. ]+$/g,
                        ''
                    );
        }

        return (
            out ||
            String(
                fallback ||
                'UNKNOWN'
            )
        );
    }

    // Provenance is not a visibility label. FAN CLUB requires authenticated
    // media-info. HIDDEN retains only authenticated other connected candidates.
    function mediaArchiveCategory(m) {
        if (m?.visibility === 'fan_club') {
            return 'FAN CLUB';
        }

        const sources = m?.sources instanceof Set
            ? m.sources
            : new Set(Array.isArray(m?.sources) ? m.sources : []);

        if (
            m?.visibility === 'hidden' ||
            sources.has('CONNECTED_HIDDEN_AUTHORIZED')
        ) {
            return 'HIDDEN';
        }

        return ({
            POST: 'POSTS',
            REEL: 'REELS',
            HIGHLIGHT: 'HIGHLIGHTS',
            STORY: 'STORIES',
            TAGGED: 'TAGGED',
            AVATAR: 'AVATAR',
        })[String(m?.type || '')] || String(m?.type || 'MEDIA');
    }

    function authenticatedMediaVisibility(raw, source) {
        if (!['CONNECTED_HIDDEN_AUTHORIZED', 'OWNED_DEEP_HYDRATION'].includes(source)) {
            return '';
        }

        const value = String(raw?.subscription_media_visibility || '')
            .trim().toLowerCase();

        if (value === 'fan_club') return 'fan_club';
        if (value === 'hidden') return 'hidden';
        return '';
    }

    function hiddenDiscoverySources(m) {
        const sources =
            m?.sources instanceof Set
                ? [...m.sources]
                : Array.isArray(m?.sources)
                    ? m.sources
                    : [];

        return sources
            .map(x =>
                String(
                    x ||
                    ''
                )
            )
            .filter(x =>
                HIDDEN_DISCOVERY_SOURCES
                    .has(x)
            );
    }

    function isHiddenMedia(m) {
        return mediaArchiveCategory(m) === 'HIDDEN';
    }

    function hiddenMediaCount() {
        let count = 0;

        for (const m of state.queue.values()) {
            if (isHiddenMedia(m)) {
                count++;
            }
        }

        return count;
    }

    function cookie(name) {
        const escaped = name.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

        const m = document.cookie.match(
            new RegExp(
                `(?:^|;\\s*)${escaped}=([^;]*)`
            )
        );

        return m
            ? decodeURIComponent(m[1])
            : '';
    }

    function log(msg, level = 'info') {
        const line =
            `[${new Date().toLocaleTimeString()}] ${msg}`;

        // Record before testing for a mounted UI; early boot logs and
        // lines already evicted from the DOM must remain exportable.
        if (state.username) {
            logArchive.accounts.add(String(state.username));
        }
        logArchive.entries.push(line);
        if (logArchive.entries.length > APP.MAX_LOG_ARCHIVE) {
            // Remove in chunks to avoid O(archiveSize) shifting
            // on every subsequent log entry in very large accounts.
            const remove = Math.min(1000, logArchive.entries.length);
            logArchive.entries.splice(0, remove);
            logArchive.dropped += remove;
        }

        if (
            state.settings.debug ||
            level !== 'info'
        ) {
            const fn =
                level === 'error'
                    ? console.error
                    : level === 'warn'
                        ? console.warn
                        : console.log;

            fn(`[${APP.NAME}]`, msg);
        }

        if (ui.log) {
            const d = document.createElement('div');

            d.textContent = line;
            d.className = `jkl-${level}`;

            ui.log.appendChild(d);

            while (
                ui.log.childElementCount >
                APP.MAX_LOG
            ) {
                ui.log.firstElementChild?.remove();
            }

            ui.log.scrollTop =
                ui.log.scrollHeight;
        }
        if (ui.logCounter) {
            ui.logCounter.textContent =
                Math.min(APP.MAX_LOG, logArchive.entries.length) +
                ' visible / ' + logArchive.entries.length +
                ' archivées' +
                (logArchive.dropped
                    ? ' (' + logArchive.dropped + ' anciennes supprimées)'
                    : '');
        }
    }

    function logExportFilename(username, at = new Date()) {
        const account = sanitize(cleanUser(username) || 'instagram');
        const pad = n => String(n).padStart(2, '0');
        const stamp =
            at.getFullYear() + '-' +
            pad(at.getMonth() + 1) + '-' +
            pad(at.getDate()) + '_' +
            pad(at.getHours()) + '-' +
            pad(at.getMinutes()) + '-' +
            pad(at.getSeconds());
        return account + ' - Instagram Backup Logs - ' + stamp + '.txt';
    }

    function buildLogExport(username, at = new Date()) {
        const account = cleanUser(username) || 'instagram';
        const saved = logArchive.entries;
        const heading = [
            'JKL Instagram Backup — Journal de session',
            'Compte actif : @' + account,
            'Comptes rencontrés : ' +
                ([...logArchive.accounts].map(x => '@' + x).join(', ') || '—'),
            'Version : ' + APP.VERSION,
            'Session ouverte : ' +
                logArchive.startedAt.toLocaleString('fr-FR'),
            'Export créé : ' + at.toLocaleString('fr-FR'),
            'Entrées conservées : ' + saved.length,
            'Anciennes entrées supprimées : ' + logArchive.dropped,
            'Capacité affichée : ' + APP.MAX_LOG,
            'Capacité exportable : ' + APP.MAX_LOG_ARCHIVE,
            'Portée : page Firefox actuelle uniquement ; aucune ' +
                'reconstitution des lignes perdues avant cette version.',
            logArchive.dropped
                ? 'ATTENTION : historique partiel (limite de mémoire atteinte).'
                : 'Historique intégral de cette session en mémoire.',
            '',
            '--- DÉBUT DES LOGS ---',
        ];
        return heading.concat(saved, ['--- FIN DES LOGS ---', ''])
            .join('\r\n');
    }

    function exportLogs() {
        if (!logArchive.entries.length) {
            status('Aucune ligne de journal à exporter.', 'warn');
            return;
        }

        const at = new Date();
        const username = cleanUser(
            state.username || ui.username?.value || currentProfile()
        ) || 'instagram';
        let url = '';
        try {
            const text = buildLogExport(username, at);
            const blob = new Blob(
                ['\uFEFF', text],
                { type: 'text/plain;charset=utf-8' }
            );
            url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = logExportFilename(username, at);
            document.body.appendChild(a);
            a.click();
            a.remove();
            const createdUrl = url;
            setTimeout(() => URL.revokeObjectURL(createdUrl), 5000);
            status(
                'Export TXT demandé : ' + logArchive.entries.length +
                ' lignes pour @' + username + '.',
                'ok'
            );
        }
        catch (e) {
            if (url) URL.revokeObjectURL(url);
            status(
                'Export des logs impossible : ' + (e?.message || e),
                'error'
            );
        }
    }

    function status(msg, level = 'normal') {
        if (!ui.status) {
            return;
        }

        ui.status.textContent = msg;
        ui.status.dataset.level = level;
    }

    function loadSettings() {
        const s =
            GM_getValue(
                APP.SETTINGS,
                {}
            );

        return {
            ...DEFAULT_SETTINGS,
            ...(s && typeof s === 'object' ? s : {}),
        };
    }

    function saveSettings() {
        GM_setValue(
            APP.SETTINGS,
            state.settings
        );
    }

    function loadDb() {
        if (
            state.dbCache &&
            typeof state.dbCache === 'object' &&
            state.dbCache.profiles
        ) {
            return state.dbCache;
        }

        const db =
            GM_getValue(
                APP.DB,
                null
            );

        state.dbCache = (
            db &&
            typeof db === 'object' &&
            db.profiles
        )
            ? db
            : {
                version: 1,
                profiles: {},
            };

        return state.dbCache;
    }

    function flushLedger(force = false) {
        if (
            !state.dbCache ||
            !state.ledgerDirty
        ) {
            return 0;
        }

        if (
            !force &&
            state.ledgerDirty <
                APP.LEDGER_FLUSH_EVERY
        ) {
            return 0;
        }

        const count =
            state.ledgerDirty;
        const startedAt =
            performance.now();

        GM_setValue(
            APP.DB,
            state.dbCache
        );

        state.ledgerDirty = 0;

        const elapsed =
            performance.now() -
            startedAt;

        log(
            `Ledger flush: ${count} records persisted in ` +
            `${(elapsed / 1000).toFixed(2)} s.`
        );

        return elapsed;
    }

    function ledgerHas(id) {
        if (!state.userId) {
            return false;
        }

        const db = loadDb();

        return !!db
            .profiles
            ?.[state.userId]
            ?.media
            ?.[String(id)];
    }

    function recordDownloaded(m, requestedPath = '') {
        const db = loadDb();

        const p =
            db.profiles[state.userId] ||= {
                userId: state.userId,
                username: state.username,
                updatedAt: null,
                media: {},
            };

        p.username =
            state.username;

        p.updatedAt =
            new Date().toISOString();

        const previous =
            p.media[String(m.id)] ||
            {};

        p.media[String(m.id)] = {
            ...previous,
            id: String(m.id),
            filename: m.filename,
            type: m.type,
            timestamp: m.timestamp || null,
            shortcode: m.shortcode || null,
            sources: [...m.sources],
            visibility: m.visibility || null,
            archiveCategory: mediaArchiveCategory(m),
            highlightId: m.highlightId || null,
            highlightIds: m.highlightIds instanceof Set
                ? [...m.highlightIds].sort() : [],
            requestedPath: String(requestedPath || ''),
            hiddenDiscovery:
                hiddenDiscoverySources(m),
            downloadedAt:
                new Date().toISOString(),
        };

        state.ledgerDirty++;

        flushLedger(false);
    }

    function datePart(ts) {
        let n =
            Number(ts || 0);

        if (
            !Number.isFinite(n) ||
            n <= 0
        ) {
            n =
                Date.now() / 1000;
        }

        if (n > 1e12) {
            n /= 1000;
        }

        const d =
            new Date(
                n * 1000
            );

        try {
            const parts =
                Object.fromEntries(
                    new Intl.DateTimeFormat(
                        'en-CA',
                        {
                            timeZone: APP.TZ,
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                        }
                    )
                        .formatToParts(d)
                        .map(
                            x => [
                                x.type,
                                x.value,
                            ]
                        )
                );

            return (
                `${parts.year}_` +
                `${parts.month}_` +
                `${parts.day}`
            );
        }

        catch {
            return (
                `${d.getUTCFullYear()}_` +
                `${String(
                    d.getUTCMonth() + 1
                ).padStart(2, '0')}_` +
                `${String(
                    d.getUTCDate()
                ).padStart(2, '0')}`
            );
        }
    }

    function filename(m) {
        return (
            `${sanitize(state.username)} - ` +
            `${m.type} - ` +
            `${datePart(m.timestamp)} - ` +
            `${sanitize(m.id)}.${m.ext}`
        );
    }


    // Instagram highlight titles are display labels, never unique identities.
    // Using the full reel ID makes folders deterministic across scans, sort
    // changes, repeated titles and Windows case-insensitive filesystems.
    function highlightFolderName(title, reelId, maxLength = 76) {
        const id = hiId(reelId);
        if (!/^\d+$/.test(id)) return '';

        // Preserve the FULL reel ID even when the username is long.
        const suffix = ` [${id}]`;
        const available = Math.max(1, maxLength - suffix.length);
        const label = sanitizePathComponent(title, 'Highlight', available);
        return `${label}${suffix}`;
    }

    function buildHighlightCatalog(tray) {
        const catalog = new Map();
        for (const node of tray) {
            const id = hiId(node?.id || node?.pk || node?.reel_id);
            if (!/^\d+$/.test(id) || catalog.has(id)) continue;

            const title = String(node?.title || '');
            catalog.set(id, Object.freeze({
                id, title, folder: highlightFolderName(title, id),
            }));
        }
        return catalog;
    }

    function highlightFolderTitle(m, maxLength = 76) {
        const id = String(m?.highlightId || '');
        const entry = state.highlightCatalog.get(id);
        return highlightFolderName(entry?.title || '', id, maxLength) ||
            highlightFolderName('', m?.id, maxLength) ||
            'Highlight';
    }

    function highlightFallbackFolderTitle(m, maxLength = 76) {
        const id = hiId(m?.highlightId || m?.id || '');
        // A genuinely different ASCII-only retry name, not the same
        // normalized display title that already failed.
        return /^\d+$/.test(id)
            ? `HL_${id}`
            : 'HL_UNKNOWN';
    }

    // Match a verified local file to its Instagram reel identity, not its
    // mutable display title. Folder renames must never trigger downloads.
    // Files in the pre-v1.5.75 shared "Highlight" folder lack an ID and
    // intentionally remain unmatched: their exact reel is unproven.
    function highlightArchivePathIdentity(m, relativePath) {
        const noMatch = { matched: false, renamed: false };
        if (m?.type !== 'HIGHLIGHT') return noMatch;

        const reelId = hiId(m.highlightId);
        if (!/^\d+$/.test(reelId)) return noMatch;

        const user = sanitizePathComponent(state.username, 'instagram', 64);
        const parts = String(relativePath || '')
            .replace(/\\/g, '/')
            .split('/')
            .filter(Boolean);
        if (parts.length < 3) return noMatch;

        const filename = String(parts[parts.length - 1] || '');
        const oldFolder = String(parts[parts.length - 2] || '');
        const category = String(parts[parts.length - 3] || '');
        const expectedCategory = sanitizePathComponent(
            `${user} - HIGHLIGHTS`, 'HIGHLIGHTS', 96
        );
        const prefix = `${user} - `;
        if (
            filename.toLowerCase() !== String(m.filename || '').toLowerCase() ||
            category.toLowerCase() !== expectedCategory.toLowerCase() ||
            !oldFolder.toLowerCase().startsWith(prefix.toLowerCase())
        ) return noMatch;

        const label = oldFolder.slice(prefix.length);
        const previousId = label.match(/\[(\d+)\]$/)?.[1] ||
            label.match(/^HL_(\d+)$/i)?.[1] || '';
        if (previousId !== reelId) return noMatch;

        const expectedFolder = archiveDownloadPath(m)
            .split('/').at(-2);
        return {
            matched: true,
            renamed: oldFolder.toLowerCase() !== expectedFolder.toLowerCase(),
            oldFolder,
            expectedFolder,
            reelId,
        };
    }

    function matchesHighlightArchivePath(m, relativePath) {
        return highlightArchivePathIdentity(m, relativePath).matched;
    }

    // A renamed highlight remains the SAME Instagram collection. This
    // metadata is kept per profile so renames can be recognized across
    // browser sessions, even when the user has not indexed a local folder.
    function reconcileHighlightTitleHistory() {
        if (!state.coverage.highlights || !state.userId) return 0;

        const db = loadDb();
        const profile = db.profiles[state.userId] ||= {
            userId: state.userId,
            username: state.username,
            updatedAt: null,
            media: {},
        };
        profile.highlights ||= {};

        let changes = 0;
        let renames = 0;
        for (const [id, current] of state.highlightCatalog) {
            const previous = profile.highlights[id];
            if (previous?.title === current.title) continue;

            if (previous && typeof previous.title === 'string') {
                renames++;
                log(
                    `HIGHLIGHT RENAMED [${id}]: "${previous.title}" → ` +
                    `"${current.title}". Same Instagram reel, NOT a new highlight. ` +
                    'Existing files remain linked by reel ID.',
                    'warn'
                );
            }

            profile.highlights[id] = {
                id, title: current.title, folder: current.folder,
                lastSeenAt: new Date().toISOString(),
            };
            changes++;
        }

        if (changes) {
            profile.updatedAt = new Date().toISOString();
            state.ledgerDirty += changes;
            try {
                flushLedger(true);
            }
            catch (e) {
                log('Could not persist HIGHLIGHT rename history: ' + e.message, 'warn');
            }
        }
        return renames;
    }

    // Firefox file inputs only index paths; they cannot rename local folders.
    // Announce verified old-folder locations without treating them as new
    // media or starting another download.
    function reportHighlightFolderRenames() {
        if (!state.diskActive || !state.highlightCatalog.size) return 0;
        const seen = new Map();

        for (const media of state.queue.values()) {
            if (media.type !== 'HIGHLIGHT' || !media.highlightId) continue;
            for (const path of state.diskPaths.get(String(media.id)) || []) {
                const identity = highlightArchivePathIdentity(media, path);
                if (!identity.matched || !identity.renamed) continue;

                const key = [
                    identity.reelId, identity.oldFolder, identity.expectedFolder,
                ].join('|');
                if (!seen.has(key)) {
                    seen.set(key, { ...identity, mediaIds: new Set() });
                }
                seen.get(key).mediaIds.add(String(media.id));
            }
        }

        for (const [key, entry] of seen) {
            if (state.highlightRenameNotices.has(key)) continue;
            state.highlightRenameNotices.add(key);
            log(
                `HIGHLIGHT FOLDER RENAME [${entry.reelId}]: ` +
                `"${entry.oldFolder}" → "${entry.expectedFolder}" ` +
                `(${entry.mediaIds.size} indexed files). ` +
                'Same collection: downloads are SKIPPED. ' +
                'Rename the folder manually on disk; Firefox cannot do it via SCAN LOCAL FOLDER.',
                'warn'
            );
        }
        return seen.size;
    }

    function archiveDownloadPath(
        m,
        username = state.username,
        options = {}
    ) {
        const user =
            sanitizePathComponent(
                username ||
                state.username ||
                'instagram',
                'instagram',
                64
            );

        const rawType =
            String(
                m?.type ||
                'MEDIA'
            );

        // Exactly one destination for each media ID; no parallel HIDDEN copy.
        const folderType = sanitizePathComponent(
            mediaArchiveCategory(m),
            'MEDIA',
            32
        );

        const parts = [
            user,
            sanitizePathComponent(
                `${user} - ${folderType}`,
                folderType,
                96
            ),
        ];

        if (rawType === 'HIGHLIGHT') {
            // Reserve enough space for the full reel identity suffix.
            const maxTitleLength = 120 - user.length - 3;
            const title = options?.safeHighlightFallback
                ? highlightFallbackFolderTitle(m, maxTitleLength)
                : highlightFolderTitle(m, maxTitleLength);
            parts.push(`${user} - ${title}`);
        }

        parts.push(
            String(
                m?.filename ||
                filename(m)
            )
        );

        return parts.join('/');
    }

    function normalizePk(x) {
        return String(
            x?.pk ??
            x?.id ??
            x?.media_id ??
            ''
        )
            .split('_')[0];
    }

    function bestImage(x, allowPreviewFallback = true) {
        const c =
            x?.image_versions2?.candidates ||
            x?.display_resources ||
            [];

        if (Array.isArray(c) && c.length) {
            const highestResolution = [...c]
                .map(v => ({
                    u: v.url || v.src || '',
                    a: Number(v.width || v.config_width || 0) *
                        Number(v.height || v.config_height || 0),
                }))
                .filter(v => v.u)
                .sort((a, b) => b.a - a.a)[0]?.u;
            if (highestResolution) return highestResolution;
        }

        // XDTMediaDict (including TAGGED GraphQL) calls the display image
        // "display_uri"; "display_url" is the older GraphQL spelling.
        // Never use this image fallback for a video (addMedia asks
        // bestVideo() for video media and refuses poster-only entries).
        return (
            x?.display_uri ||
            x?.display_url ||
            (allowPreviewFallback
                ? (x?.thumbnail_url ||
                    x?.profile_pic_url_hd ||
                    x?.profile_pic_url ||
                    '')
                : '')
        );
    }

    function bestVideo(x) {
        const c =
            x?.video_versions ||
            x?.video_resources ||
            [];

        if (
            Array.isArray(c) &&
            c.length
        ) {
            return [...c]
                .map(
                    v => ({
                        u:
                            v.url ||
                            v.src ||
                            '',

                        a:
                            Number(
                                v.width ||
                                v.config_width ||
                                0
                            ) *
                            Number(
                                v.height ||
                                v.config_height ||
                                0
                            ),

                        b:
                            Number(
                                v.bitrate ||
                                0
                            ),
                    })
                )
                .filter(v => v.u)
                .sort(
                    (a, b) =>
                        b.a - a.a ||
                        b.b - a.b
                )[0]
                ?.u || '';
        }

        return x?.video_url || '';
    }

    function isVideo(x) {
        return !!(
            x?.video_versions?.length ||
            x?.video_resources?.length ||
            x?.video_url ||
            x?.is_video ||
            Number(x?.media_type) === 2 ||
            x?.__typename === 'GraphVideo'
        );
    }

    function rootKind(
        x,
        forced = ''
    ) {
        if (forced) {
            return forced;
        }

        const p =
            String(
                x?.product_type ||
                x?.media_product_type ||
                ''
            )
                .toLowerCase();

        return (
            p === 'clips' ||
            p === 'reels'
        )
            ? 'REEL'
            : 'POST';
    }

    function originalToken(url) {
        try {
            return decodeURIComponent(
                new URL(url)
                    .pathname
                    .split('/')
                    .pop() ||
                ''
            )
                .split('.')[0]
                .split('_')[0]
                .toLowerCase();
        }

        catch {
            return '';
        }
    }

    function registerOwnedRoot(root, type, source, rootId, units, resolvedUnits) {
        if (!['POST', 'REEL'].includes(type) || !rootId) {
            return null;
        }

        const id = String(rootId);
        const code = String(
            root?.code ||
            root?.shortcode ||
            ''
        );

        const product = String(
            root?.product_type ||
            root?.media_product_type ||
            ''
        ).toLowerCase();

        const carouselLike =
            product === 'carousel_container' ||
            product === 'carousel' ||
            Number(root?.media_type) === 8 ||
            root?.__typename === 'GraphSidecar' ||
            units.length > 1;

        const sidecarHasNext =
            root
                ?.edge_sidecar_to_children
                ?.page_info
                ?.has_next_page === true;

        const unitIds =
            units
                .map(normalizePk)
                .filter(Boolean)
                .map(String);

        const uniqueUnitIds =
            new Set(unitIds);

        const declaredCarouselUnits =
            carouselLike
                ? Math.max(
                    0,
                    Number(
                        root?.carousel_media_count ||
                        0
                    ) || 0
                )
                : 0;

        /*
         * carousel_media_count is useful as a discovery hint, but Instagram
         * may keep a historical/declarative count that is larger than the
         * currently accessible carousel_media array. Therefore:
         *
         * - PROFILE/GraphQL observations whose declared count is larger than
         *   their explicit children stay ambiguous and force deep hydration;
         * - a fresh OWNED media-info response with an explicit, non-empty,
         *   unique carousel_media array is authoritative for the currently
         *   accessible structure;
         * - explicit child IDs previously observed remain hard evidence because
         *   expectedUnits never decreases.
         */
        const authoritativeDeepCarousel =
            source === 'OWNED_DEEP_HYDRATION' &&
            carouselLike &&
            Array.isArray(root?.carousel_media) &&
            root.carousel_media.length > 0 &&
            uniqueUnitIds.size === units.length;

        const declaredNeedsExpansion =
            carouselLike &&
            declaredCarouselUnits >
                units.length &&
            !authoritativeDeepCarousel;

        const structureObservationComplete =
            uniqueUnitIds.size === units.length &&
            !sidecarHasNext &&
            !declaredNeedsExpansion &&
            !(
                carouselLike &&
                units.length <= 1 &&
                !authoritativeDeepCarousel
            );

        const rec = state.rootCatalog.get(id) || {
            id,
            type,
            shortcode: '',
            sources: new Set(),
            expectedUnits: 1,
            lastResolvedUnits: 0,
            forceHydrate: false,
            hydratedByApi: false,
            apiUnits: 0,
            knownUnitIds: new Set(),
            structureEvidenceUnits: 0,
            declaredUnitsHint: 0,
            structureNeedsExpansion: false,
            structureComplete: false,
        };

        if (
            !rec.type ||
            (PRIORITY[type] || 0) >=
                (PRIORITY[rec.type] || 0)
        ) {
            rec.type = type;
        }

        rec.shortcode = code || rec.shortcode;
        rec.sources.add(source || type);

        rec.knownUnitIds ||=
            new Set();

        for (const unitId of uniqueUnitIds) {
            rec.knownUnitIds.add(
                unitId
            );
        }

        rec.declaredUnitsHint =
            Math.max(
                Number(
                    rec.declaredUnitsHint ||
                    0
                ),
                Number(
                    declaredCarouselUnits ||
                    0
                )
            );

        rec.expectedUnits = Math.max(
            Number(rec.expectedUnits || 1),
            Number(units.length || 1)
        );

        rec.lastResolvedUnits = Math.max(
            Number(rec.lastResolvedUnits || 0),
            Number(resolvedUnits || 0)
        );

        if (structureObservationComplete) {
            rec.structureEvidenceUnits =
                Math.max(
                    Number(
                        rec.structureEvidenceUnits ||
                        0
                    ),
                    Number(
                        units.length ||
                        0
                    )
                );

            if (
                Number(
                    units.length ||
                    0
                ) >=
                    Number(
                        rec.expectedUnits ||
                        1
                    )
            ) {
                rec.structureNeedsExpansion =
                    false;
            }
        }
        else if (
            sidecarHasNext ||
            declaredNeedsExpansion ||
            (
                carouselLike &&
                units.length <= 1 &&
                !authoritativeDeepCarousel
            ) ||
            uniqueUnitIds.size !==
                units.length
        ) {
            rec.structureNeedsExpansion =
                true;
        }

        rec.structureComplete =
            !rec.structureNeedsExpansion &&
            Number(
                rec.structureEvidenceUnits ||
                0
            ) >=
                Number(
                    rec.expectedUnits ||
                    1
                ) &&
            rec.knownUnitIds.size >=
                Number(
                    rec.expectedUnits ||
                    1
                );

        if (
            resolvedUnits < units.length ||
            !rec.structureComplete
        ) {
            rec.forceHydrate = true;
        }

        if (source === 'OWNED_DEEP_HYDRATION') {
            rec.hydratedByApi = true;
            rec.apiUnits = units.length || 1;
            rec.expectedUnits =
                Math.max(
                    Number(
                        rec.expectedUnits ||
                        1
                    ),
                    Number(
                        units.length ||
                        1
                    )
                );

            if (
                structureObservationComplete &&
                Number(
                    units.length ||
                    0
                ) <
                    rec.expectedUnits
            ) {
                /*
                 * A fresh deep response must never erase stronger explicit
                 * child evidence seen earlier in the same scan.
                 */
                rec.structureNeedsExpansion =
                    true;
            }
            else if (
                structureObservationComplete &&
                Number(
                    units.length ||
                    0
                ) >=
                    rec.expectedUnits
            ) {
                rec.structureNeedsExpansion =
                    false;
            }

            rec.structureComplete =
                !rec.structureNeedsExpansion &&
                Number(
                    rec.structureEvidenceUnits ||
                    0
                ) >=
                    rec.expectedUnits &&
                rec.knownUnitIds.size >=
                    rec.expectedUnits;

            rec.forceHydrate =
                resolvedUnits <
                    rec.expectedUnits ||
                !rec.structureComplete;
        }

        state.rootCatalog.set(id, rec);
        return rec;
    }

    function addMedia(
        raw,
        typeHint = '',
        source = '',
        context = null
    ) {
        if (!raw) {
            return 0;
        }

        const root =
            raw?.media &&
            typeof raw.media === 'object'
                ? raw.media
                : raw;

        const type =
            rootKind(
                root,
                typeHint
            );
        const confirmedVisibility = authenticatedMediaVisibility(root, source);

        if (
            type === 'POST' &&
            !scanSelected('post')
        ) {
            return 0;
        }

        if (
            type === 'REEL' &&
            !scanSelected('reel')
        ) {
            return 0;
        }

        const rootCode = String(
            root?.code ||
            root?.shortcode ||
            ''
        );

        const rootId =
            normalizePk(root) ||
            shortcodeId(rootCode) ||
            rootCode;

        if (rootId) {
            registerOwnedRootMembership(
                rootId,
                type
            );
        }

        const children =
            Array.isArray(
                root.carousel_media
            ) &&
            root.carousel_media.length
                ? root.carousel_media
                : (
                    root
                        ?.edge_sidecar_to_children
                        ?.edges ||
                    []
                )
                    .map(e => e.node)
                    .filter(Boolean);

        const units =
            children.length
                ? children
                : [root];

        let added = 0;
        let resolvedUnits = 0;

        for (
            const child
            of units
        ) {
            const id =
                normalizePk(child);

            if (!id) {
                continue;
            }

            const video =
                isVideo(child);

            const url =
                video
                    ? bestVideo(child)
                    // A TAGGED preview/avatar does not prove a full photo.
                    : bestImage(child, type !== 'TAGGED');

            const diskMeta =
                state.diskActive
                    ? state.diskCanonicalMeta.get(
                        String(id)
                    )
                    : null;

            const diskBacked =
                state.diskActive &&
                state.diskCanonical.has(
                    String(id)
                ) &&
                String(
                    diskMeta?.type ||
                    ''
                )
                    .toUpperCase() ===
                    String(type)
                        .toUpperCase();

            if (
                !url &&
                !diskBacked
            ) {
                continue;
            }

            if (url) {
                resolvedUnits++;
            }

            const diskExt =
                String(
                    diskMeta?.ext ||
                    ''
                )
                    .toLowerCase();

            const m = {
                id,
                type,

                timestamp:
                    Number(
                        child?.taken_at ||
                        child?.taken_at_timestamp ||
                        root?.taken_at ||
                        root?.taken_at_timestamp ||
                        0
                    ),

                ext:
                    url
                        ? (
                            video
                                ? 'mp4'
                                : 'jpg'
                        )
                        : (
                            diskExt ||
                            (
                                video
                                    ? 'mp4'
                                    : 'jpg'
                            )
                        ),

                url,
                visibility: confirmedVisibility,

                diskBacked:
                    !url &&
                    diskBacked,

                shortcode:
                    String(
                        root?.code ||
                        root?.shortcode ||
                        child?.code ||
                        child?.shortcode ||
                        ''
                    ),

                rootCount:
                    units.length,

                rootIds:
                    new Set(
                        rootId
                            ? [String(rootId)]
                            : []
                    ),

                highlightId: type === 'HIGHLIGHT'
                    ? String(context?.highlightId || '')
                    : '',
                highlightIds: new Set(
                    type === 'HIGHLIGHT' && context?.highlightId
                        ? [String(context.highlightId)]
                        : []
                ),

                originalToken:
                    originalToken(url),

                sources:
                    new Set([
                        source || type,
                    ]),
            };

            m.filename =
                filename(m);

            const old =
                state.queue.get(id);

            if (!old) {
                state.queue.set(
                    id,
                    m
                );

                added++;
            }

            else {
                old.sources.add(
                    source || type
                );
                if (old.visibility === 'fan_club' || confirmedVisibility === 'fan_club') {
                    m.visibility = 'fan_club';
                    old.visibility = 'fan_club';
                } else if (!confirmedVisibility) {
                    m.visibility = old.visibility || '';
                } else {
                    old.visibility = confirmedVisibility;
                }

                old.rootIds ||= new Set();

                if (rootId) {
                    old.rootIds.add(
                        String(rootId)
                    );
                }

                // Preserve every reel membership when one media is reused
                // in multiple highlights, while retaining one file per ID.
                if (type === 'HIGHLIGHT' && m.highlightId) {
                    old.highlightIds ||= new Set(
                        old.highlightId ? [old.highlightId] : []
                    );
                    old.highlightIds.add(m.highlightId);
                    old.highlightId = [...old.highlightIds].sort()[0];
                }

                const freshApi =
                    source === 'OWNED_DEEP_HYDRATION';

                if (
                    freshApi ||
                    (
                        !old.url &&
                        !!m.url
                    ) ||
                    (PRIORITY[type] || 0) >
                    (PRIORITY[old.type] || 0)
                ) {
                    m.sources =
                        old.sources;

                    m.rootIds =
                        old.rootIds;
                    m.highlightIds = old.highlightIds || m.highlightIds;
                    m.highlightId = old.highlightId || m.highlightId;
                    m.visibility = old.visibility || m.visibility;

                    state.queue.set(
                        id,
                        m
                    );
                }
            }
        }

        registerOwnedRoot(
            root,
            type,
            source,
            rootId,
            units,
            resolvedUnits
        );

        return added;
    }

    function queuedUnitsForRoot(rootId) {
        const id = String(rootId || '');

        if (!id) {
            return 0;
        }

        let n = 0;

        for (const m of state.queue.values()) {
            if (m?.rootIds?.has?.(id)) {
                n++;
            }
        }

        return n;
    }

    async function fetchOwnedMediaInfo(rootId, label = 'OWNED media', options = {}) {
        const id = String(rootId || '');

        if (!/^\d+$/.test(id)) {
            throw new Error(`${label}: invalid root ID ${id || '-'}`);
        }

        // TAGGED uses one existing same-origin media-info GET and no retry:
        // an incomplete listing is not permission for repeated mobile API probes.
        const singleWebOnly = options?.singleWebOnly === true;
        const endpoints = singleWebOnly
            ? [`https://www.instagram.com/api/v1/media/${id}/info/`]
            : [
                `https://i.instagram.com/api/v1/media/${id}/info/`,
                `https://www.instagram.com/api/v1/media/${id}/info/`,
            ];
        const maxAttempts = singleWebOnly ? 1 : APP.HYDRATE_RETRIES;

        let last = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            let invalidJson200Endpoints = 0;

            for (const url of endpoints) {
                if (state.cancelled) {
                    throw new Error('Cancelled');
                }

                try {
                    const r = await gmRequest({
                        method: 'GET',
                        url,
                        feedbackLabel: label,
                        headers: {
                            Accept: '*/*',
                            ...(singleWebOnly ? {} : {'User-Agent': APP.MOBILE_UA}),
                            'X-IG-App-ID': APP.APP_ID,
                            Referer: 'https://www.instagram.com/',
                        },
                    });

                    if (feedbackRequiredIn(r.responseText)) {
                        throw feedbackCircuitBreak(
                            `${label}: Instagram returned feedback_required.`
                        );
                    }

                    let d = null;

                    try {
                        d = JSON.parse(r.responseText);
                    }
                    catch {
                        const e = new Error(`HTTP ${r.status} non JSON`);
                        e.status = Number(r.status || 0);

                        if (e.status === 200) {
                            e.code = 'IG_MEDIA_INFO_PROTOCOL';
                        }

                        throw e;
                    }

                    const item = d?.items?.[0];

                    if (
                        Number(r.status) === 200 &&
                        d?.status === 'ok' &&
                        item
                    ) {
                        return item;
                    }

                    const msg =
                        d?.message ||
                        d?.status ||
                        `HTTP ${r.status}`;

                    const e = new Error(msg);
                    e.status = Number(r.status || 0);

                    if (feedbackRequiredIn(msg)) {
                        throw feedbackCircuitBreak(
                            `${label}: Instagram returned feedback_required.`
                        );
                    }

                    throw e;
                }
                catch (e) {
                    last = e;
                    // A hard auth failure is session-scoped, not a reason
                    // to try alternate domains or retry six times.
                    throwIfInstagramStop(e, label);
                    const status = Number(e?.status || 0);
                    if (status === 401 || status === 403) {
                        throw apiUnhealthyError(
                            `${label}: authenticated media-info denied (HTTP ${status}); stopped without retries.`
                        );
                    }
                    if ([400, 404, 410, 422].includes(status)) {
                        // A denied/absent media root may be legitimate, but
                        // repeating the same request cannot make it valid.
                        throw e;
                    }

                    if (e?.code === 'IG_MEDIA_INFO_PROTOCOL') {
                        invalidJson200Endpoints++;

                        if (invalidJson200Endpoints >= endpoints.length) {
                            throw apiUnhealthyError(
                                `${label}: both Instagram media-info endpoints returned HTTP 200 non-JSON; ` +
                                `scan stopped rather than retrying an unhealthy API session.`
                            );
                        }

                        continue;
                    }

                    if (Number(e?.status || 0) === 429) {
                        throw rateLimitCircuitBreak(
                            `${label}: Instagram returned HTTP 429.`
                        );
                    }

                    if (
                        e?.message === 'Cancelled' ||
                        e?.code === 'IG_FEEDBACK_REQUIRED' ||
                        e?.code === 'IG_RATE_LIMITED'
                    ) {
                        throw e;
                    }
                }
            }

            if (attempt < maxAttempts) {
                const wait =
                    last?.status === 429
                        ? 6000 + rand(0, 2500)
                        : 1200 * attempt + rand(0, 600);

                await sleep(wait);
            }
        }

        throw (
            last ||
            new Error(`${label}: media info failed`)
        );
    }

    function hydrationRequestUuid() {
        const key = 'JKL_IG_BACKUP_HYDRATE_UUID_V1';
        let value = String(
            GM_getValue(
                key,
                ''
            ) || ''
        );

        if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ) {
            if (typeof crypto?.randomUUID === 'function') {
                value = crypto.randomUUID();
            }
            else {
                const bytes = new Uint8Array(16);
                crypto.getRandomValues(bytes);
                bytes[6] = (bytes[6] & 0x0f) | 0x40;
                bytes[8] = (bytes[8] & 0x3f) | 0x80;

                const hex =
                    [...bytes]
                        .map(x =>
                            x
                                .toString(16)
                                .padStart(2, '0')
                        )
                        .join('');

                value =
                    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
                    `${hex.slice(16, 20)}-${hex.slice(20)}`;
            }

            GM_setValue(
                key,
                value
            );
        }

        return value;
    }

    async function fetchOwnedMediaInfosBulk(rootIds, label = 'OWNED bulk media') {
        const ids =
            [...new Set(
                (rootIds || [])
                    .map(x => String(x || ''))
                    .filter(x => /^\d+$/.test(x))
            )];

        if (!ids.length) {
            return [];
        }

        const params =
            new URLSearchParams({
                media_ids: ids.join(','),
                ranked_content: 'true',
                include_inactive_reel: 'true',
                _uuid: hydrationRequestUuid(),
            });

        const csrf =
            cookie('csrftoken');

        if (csrf) {
            params.set(
                '_csrftoken',
                csrf
            );
        }

        const endpoints = [
            `https://i.instagram.com/api/v1/media/infos/?${params.toString()}`,
            `https://www.instagram.com/api/v1/media/infos/?${params.toString()}`,
        ];

        let last = null;

        for (const url of endpoints) {
            if (state.cancelled) {
                throw new Error('Cancelled');
            }

            try {
                const headers = {
                    Accept: '*/*',
                    'User-Agent': APP.MOBILE_UA,
                    'X-IG-App-ID': APP.APP_ID,
                    Referer: 'https://www.instagram.com/',
                };

                if (csrf) {
                    headers['X-CSRFToken'] = csrf;
                }

                const r = await gmRequest({
                    method: 'GET',
                    url,
                    feedbackLabel: label,
                    headers,
                });

                if (feedbackRequiredIn(r.responseText)) {
                    throw feedbackCircuitBreak(
                        `${label}: Instagram returned feedback_required.`
                    );
                }

                let d = null;

                try {
                    d = JSON.parse(r.responseText);
                }
                catch {
                    const e = new Error(
                        `HTTP ${r.status} non JSON`
                    );

                    e.status =
                        Number(
                            r.status ||
                            0
                        );

                    throw e;
                }

                if (
                    Number(r.status) === 200 &&
                    Array.isArray(d?.items)
                ) {
                    return d.items;
                }

                const e = new Error(
                    d?.message ||
                    d?.status ||
                    `HTTP ${r.status}`
                );

                e.status =
                    Number(
                        r.status ||
                        0
                    );

                throw e;
            }
            catch (e) {
                last = e;

                throwIfInstagramStop(
                    e,
                    label
                );

                const status = Number(e?.status || 0);
                if (status === 401 || status === 403) {
                    throw apiUnhealthyError(
                        `${label}: authenticated bulk media-info denied (HTTP ${status}); stopped.`
                    );
                }
                if ([400, 404, 410, 422].includes(status)) {
                    throw e;
                }

                if (
                    Number(
                        e?.status ||
                        0
                    ) === 429
                ) {
                    throw rateLimitCircuitBreak(
                        `${label}: Instagram returned HTTP 429.`
                    );
                }
            }
        }

        throw (
            last ||
            new Error(
                `${label}: bulk media info failed`
            )
        );
    }

    function markOwnedHydrated(rec, item) {
        addMedia(
            item,
            rec.type,
            'OWNED_DEEP_HYDRATION'
        );

        const current =
            state.rootCatalog.get(rec.id) ||
            rec;

        const queued =
            queuedUnitsForRoot(rec.id);

        const expected = Math.max(
            1,
            Number(
                current.expectedUnits ||
                1
            )
        );

        if (
            queued < expected ||
            !current.structureComplete
        ) {
            return false;
        }

        current.hydratedByApi = true;
        current.apiUnits = expected;
        current.forceHydrate = false;

        const declaredHint =
            Math.max(
                0,
                Number(
                    current.declaredUnitsHint ||
                    item?.carousel_media_count ||
                    0
                ) || 0
            );

        if (
            declaredHint >
            expected
        ) {
            log(
                `OWNED carousel count hint differs for ${rec.type} ${rec.id}` +
                (rec.shortcode ? ` (${rec.shortcode})` : '') +
                `: declared=${declaredHint}, accessible=${expected}; ` +
                `accepting explicit deep media-info children as current accessible structure.`
            );
        }

        state.rootCatalog.set(
            rec.id,
            current
        );

        return true;
    }

    function diskSatisfiesOwnedRoot(rec) {
        if (
            !state.diskActive ||
            state.settings.force ||
            !rec?.structureComplete
        ) {
            return false;
        }

        const expected =
            Math.max(
                1,
                Number(
                    rec.expectedUnits ||
                    1
                )
            );

        const unitIds =
            rec.knownUnitIds instanceof Set
                ? [...rec.knownUnitIds]
                    .map(String)
                    .filter(Boolean)
                : [];

        if (
            unitIds.length <
            expected
        ) {
            return false;
        }

        for (const unitId of unitIds) {
            const queued = state.queue.get(unitId);
            if (
                !queued ||
                !state.diskLocations.get(unitId)?.has(mediaArchiveCategory(queued))
            ) {
                return false;
            }

            const meta =
                state.diskCanonicalMeta.get(
                    unitId
                );

            if (
                String(
                    meta?.type ||
                    ''
                )
                    .toUpperCase() !==
                String(
                    rec.type ||
                    ''
                )
                    .toUpperCase()
            ) {
                return false;
            }
        }

        // No duplicate HIDDEN copy requirement: the single file already
        // verified in its exact target category is sufficient.

        return true;
    }

    async function hydrateOwnedRootsDeep() {
        state.coverage.ownedHydration = false;

        const allTargets =
            [...state.rootCatalog.values()]
                .filter(rec =>
                    (rec.type === 'POST' && scanSelected('post')) ||
                    (rec.type === 'REEL' && scanSelected('reel'))
                )
                .sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === 'POST' ? -1 : 1;
                    }

                    return String(a.id).localeCompare(String(b.id));
                });

        const targets = [];
        let preResolved = 0;
        let diskSatisfied = 0;

        for (const rec of allTargets) {
            const expected = Math.max(
                1,
                Number(
                    rec.expectedUnits ||
                    1
                )
            );

            const queued =
                queuedUnitsForRoot(rec.id);

            const resolved = Math.max(
                0,
                Number(
                    rec.lastResolvedUnits ||
                    0
                )
            );

            const completeFromScan =
                !rec.forceHydrate &&
                rec.structureComplete &&
                queued >= expected &&
                resolved >= expected;

            if (completeFromScan) {
                preResolved++;
            }
            else if (
                diskSatisfiesOwnedRoot(
                    rec
                )
            ) {
                diskSatisfied++;
            }
            else {
                targets.push(rec);
            }
        }

        state.hydration.totalRoots =
            allTargets.length;

        state.hydration.diskSatisfiedRoots =
            diskSatisfied;

        state.hydration.hydratedRoots =
            preResolved +
            diskSatisfied;

        state.hydration.failedRoots = 0;

        state.hydration.filesBefore =
            state.queue.size;

        state.hydration.filesAfter =
            state.queue.size;

        if (!allTargets.length) {
            state.coverage.ownedHydration = true;
            updateStats();
            return true;
        }

        setScanProgressPhase(
            'DEEP HYDRATION',
            state.hydration.hydratedRoots,
            allTargets.length,
            targets.length
                ? `${targets.length} API remaining`
                : 'no API needed'
        );

        log(
            `Deep hydration plan: total=${allTargets.length}, ` +
            `already_complete=${preResolved}, disk_satisfied=${diskSatisfied}, ` +
            `api_needed=${targets.length}.`
        );

        if (!targets.length) {
            state.coverage.ownedHydration = true;
            updateStats();

            log(
                `OWNED deep hydration complete: ` +
                `roots=${state.hydration.hydratedRoots}/${state.hydration.totalRoots}, ` +
                `files=${state.hydration.filesBefore}→${state.hydration.filesAfter}, ` +
                `failed=0, reused=${preResolved}, disk_satisfied=${diskSatisfied}, ` +
                `bulk=0, single=0, ended=true.`
            );

            return true;
        }

        let bulkResolved = 0;
        let bulkRequests = 0;
        let singleTargets =
            targets;

        if (
            targets.length >=
            APP.HYDRATE_BULK_THRESHOLD
        ) {
            singleTargets = [];

            log(
                `Large OWNED hydration: trying bulk media-info in batches of ` +
                `${APP.HYDRATE_BULK_SIZE} for ${targets.length} roots.`
            );

            for (
                let offset = 0;
                offset < targets.length;
                offset += APP.HYDRATE_BULK_SIZE
            ) {
                if (state.cancelled) {
                    throw new Error('Cancelled');
                }

                const batch =
                    targets.slice(
                        offset,
                        offset +
                            APP.HYDRATE_BULK_SIZE
                    );

                let items;

                try {
                    items =
                        await fetchOwnedMediaInfosBulk(
                            batch.map(
                                x => x.id
                            ),
                            `OWNED bulk ${Math.floor(offset / APP.HYDRATE_BULK_SIZE) + 1}`
                        );

                    bulkRequests++;
                }
                catch (e) {
                    throwIfInstagramStop(
                        e,
                        'OWNED bulk hydration'
                    );

                    log(
                        `Bulk media-info unavailable on large hydration: ${e.message}. ` +
                        `Stopping before falling back to thousands of single requests.`,
                        'warn'
                    );

                    state.hydration.failedRoots +=
                        targets.length -
                        bulkResolved;

                    state.hydration.filesAfter =
                        state.queue.size;

                    updateStats();

                    log(
                        `OWNED deep hydration incomplete: ` +
                        `roots=${state.hydration.hydratedRoots}/${state.hydration.totalRoots}, ` +
                        `files=${state.hydration.filesBefore}→${state.hydration.filesAfter}, ` +
                        `failed=${state.hydration.failedRoots}, bulk_requests=${bulkRequests}, ` +
                        `ended=false.`,
                        'warn'
                    );

                    return false;
                }

                const byId =
                    new Map();

                for (const item of items) {
                    const id =
                        normalizePk(item);

                    if (id) {
                        byId.set(
                            String(id),
                            item
                        );
                    }
                }

                for (const rec of batch) {
                    const item =
                        byId.get(
                            String(rec.id)
                        );

                    if (
                        item &&
                        markOwnedHydrated(
                            rec,
                            item
                        )
                    ) {
                        state.hydration.hydratedRoots++;
                        bulkResolved++;
                    }
                    else {
                        singleTargets.push(rec);
                    }
                }

                status(
                    `Deep hydration ${state.hydration.hydratedRoots}/${allTargets.length}…`
                );

                state.hydration.filesAfter =
                    state.queue.size;

                setScanProgressPhase(
                    'DEEP HYDRATION',
                    state.hydration.hydratedRoots +
                        state.hydration.failedRoots,
                    allTargets.length,
                    `${Math.max(
                        0,
                        allTargets.length -
                            state.hydration.hydratedRoots -
                            state.hydration.failedRoots
                    )} roots remaining`
                );

                updateStats();

                if (
                    offset +
                        APP.HYDRATE_BULK_SIZE <
                    targets.length
                ) {
                    await sleep(
                        rand(
                            APP.PAGE_MIN,
                            APP.PAGE_MAX
                        )
                    );
                }
            }

            log(
                `Bulk OWNED hydration: requests=${bulkRequests}, ` +
                `resolved=${bulkResolved}/${targets.length}, ` +
                `single_fallback=${singleTargets.length}.`
            );

            if (
                singleTargets.length >
                APP.HYDRATE_SINGLE_FALLBACK_CAP
            ) {
                state.hydration.failedRoots +=
                    singleTargets.length;

                state.hydration.filesAfter =
                    state.queue.size;

                updateStats();

                log(
                    `Large hydration left ${singleTargets.length} unresolved roots after bulk, ` +
                    `above safe single-request cap ${APP.HYDRATE_SINGLE_FALLBACK_CAP}; ` +
                    `scan remains INCOMPLETE instead of hammering Instagram.`,
                    'warn'
                );

                return false;
            }
        }

        if (!singleTargets.length) {
            state.hydration.filesAfter =
                state.queue.size;

            state.coverage.ownedHydration =
                state.hydration.failedRoots === 0 &&
                state.hydration.hydratedRoots ===
                    state.hydration.totalRoots;

            updateStats();

            log(
                `OWNED deep hydration complete: ` +
                `roots=${state.hydration.hydratedRoots}/${state.hydration.totalRoots}, ` +
                `files=${state.hydration.filesBefore}→${state.hydration.filesAfter}, ` +
                `failed=${state.hydration.failedRoots}, reused=${preResolved}, ` +
                `disk_satisfied=${diskSatisfied}, bulk_requests=${bulkRequests}, ` +
                `bulk_resolved=${bulkResolved}, single=0, ` +
                `ended=${state.coverage.ownedHydration}.`
            );

            return state.coverage.ownedHydration;
        }

        const hydrateWorkerCap =
            singleTargets.length >=
                APP.HYDRATE_LARGE_THRESHOLD
                ? APP.HYDRATE_LARGE_WORKERS
                : APP.HYDRATE_WORKERS;

        const workerCount = Math.min(
            hydrateWorkerCap,
            singleTargets.length
        );

        log(
            `Deep-hydrating ${singleTargets.length} unresolved OWNED roots via single media-info ` +
            `with ${workerCount} workers…`
        );

        status(
            `Deep hydration ${state.hydration.hydratedRoots}/${allTargets.length}…`
        );

        let next = 0;
        let completed = 0;

        const worker = async workerId => {
            if (workerId > 0) {
                await sleep(
                    workerId *
                    120
                );
            }

            while (true) {
                if (state.cancelled) {
                    throw new Error('Cancelled');
                }

                const index = next++;

                if (
                    index >=
                    singleTargets.length
                ) {
                    return;
                }

                const rec =
                    singleTargets[index];

                try {
                    const item =
                        await fetchOwnedMediaInfo(
                            rec.id,
                            `OWNED API ${index + 1}/${singleTargets.length}`
                        );

                    if (
                        !markOwnedHydrated(
                            rec,
                            item
                        )
                    ) {
                        const current =
                            state.rootCatalog.get(rec.id) ||
                            rec;

                        const queued =
                            queuedUnitsForRoot(rec.id);

                        const expected =
                            Math.max(
                                1,
                                Number(
                                    current.expectedUnits ||
                                    1
                                )
                            );

                        throw new Error(
                            `resolved ${queued}/${expected} file(s); ` +
                            `structure_complete=${!!current.structureComplete}, ` +
                            `needs_expansion=${!!current.structureNeedsExpansion}, ` +
                            `media_type=${item?.media_type ?? '-'}, ` +
                            `carousel_media=${Array.isArray(item?.carousel_media) ? item.carousel_media.length : '-'}, ` +
                            `carousel_media_count=${item?.carousel_media_count ?? '-'}`
                        );
                    }

                    state.hydration.hydratedRoots++;
                }
                catch (e) {
                    if (
                        e?.code === 'IG_FEEDBACK_REQUIRED' ||
                        state.feedbackRequired
                    ) {
                        state.hydration.failedRoots++;

                        throw feedbackCircuitBreak(
                            `Instagram returned feedback_required during OWNED deep hydration ` +
                            `at API request ${index + 1}/${singleTargets.length}. Remaining roots were not queried.`
                        );
                    }

                    if (
                        e?.code === 'IG_RATE_LIMITED' ||
                        state.rateLimited ||
                        Number(
                            e?.status ||
                            0
                        ) === 429
                    ) {
                        state.hydration.failedRoots++;

                        throw rateLimitCircuitBreak(
                            `Instagram rate limit during OWNED deep hydration ` +
                            `at API request ${index + 1}/${singleTargets.length}. Remaining roots were not queried.`
                        );
                    }

                    if (
                        e?.code ===
                        'IG_API_UNHEALTHY'
                    ) {
                        state.hydration.failedRoots++;
                        throw e;
                    }

                    state.hydration.failedRoots++;

                    log(
                        `OWNED hydrate failed ${rec.type} ${rec.id}` +
                        (rec.shortcode ? ` (${rec.shortcode})` : '') +
                        `: ${e.message}`,
                        'warn'
                    );
                }

                completed++;

                setScanProgressPhase(
                    'DEEP HYDRATION',
                    state.hydration.hydratedRoots +
                        state.hydration.failedRoots,
                    allTargets.length,
                    `${Math.max(
                        0,
                        allTargets.length -
                            state.hydration.hydratedRoots -
                            state.hydration.failedRoots
                    )} roots remaining`
                );

                status(
                    `Deep hydration ${state.hydration.hydratedRoots}/${allTargets.length}…`
                );

                if (
                    completed % 8 === 0 ||
                    completed ===
                        singleTargets.length
                ) {
                    state.hydration.filesAfter =
                        state.queue.size;

                    updateStats();
                }

                if (
                    next <
                    singleTargets.length
                ) {
                    await sleep(
                        rand(
                            APP.HYDRATE_MIN,
                            APP.HYDRATE_MAX
                        )
                    );
                }
            }
        };

        await Promise.all(
            Array.from(
                { length: workerCount },
                (_, workerId) =>
                    worker(workerId)
            )
        );

        state.hydration.filesAfter =
            state.queue.size;

        state.coverage.ownedHydration =
            state.hydration.failedRoots === 0 &&
            state.hydration.hydratedRoots ===
                state.hydration.totalRoots;

        updateStats();

        log(
            `OWNED deep hydration complete: ` +
            `roots=${state.hydration.hydratedRoots}/${state.hydration.totalRoots}, ` +
            `files=${state.hydration.filesBefore}→${state.hydration.filesAfter}, ` +
            `failed=${state.hydration.failedRoots}, reused=${preResolved}, ` +
            `disk_satisfied=${diskSatisfied}, bulk_requests=${bulkRequests}, ` +
            `bulk_resolved=${bulkResolved}, ` +
            `single=${singleTargets.length}, workers=${workerCount}, ` +
            `ended=${state.coverage.ownedHydration}.`
        );

        return state.coverage.ownedHydration;
    }

    function keyedConnection(data, key) {
        const root = data?.data || data;
        const stack = [root];
        const seen = new Set();

        while (stack.length) {
            const o = stack.pop();
            if (!o || typeof o !== 'object' || seen.has(o)) {
                continue;
            }

            seen.add(o);

            if (Object.prototype.hasOwnProperty.call(o, key)) {
                const c = o[key];
                if (c && Array.isArray(c.edges)) {
                    return c;
                }
            }

            for (const v of Object.values(o)) {
                if (v && typeof v === 'object') {
                    stack.push(v);
                }
            }
        }

        return null;
    }

    function requestTargetsCurrentProfile(meta) {
        const targetUser = cleanUser(
            state.username ||
            currentProfile()
        ).toLowerCase();

        const requestUser = cleanUser(
            meta?.variables?.username ||
            meta?.variables?.data?.username ||
            ''
        ).toLowerCase();

        if (targetUser && requestUser) {
            return targetUser === requestUser;
        }

        const targetId = String(state.userId || '').split('_')[0];
        const requestId = String(
            meta?.variables?.user_id ||
            meta?.variables?.id ||
            meta?.variables?.target_user_id ||
            meta?.variables?.data?.target_user_id ||
            ''
        ).split('_')[0];

        return !!(
            targetId &&
            requestId &&
            targetId === requestId
        );
    }
    function connection(
        data,
        key
    ) {
        const direct =
            key
                ? (
                    data?.data?.[key] ||
                    data?.[key]
                )
                : null;

        if (
            direct &&
            Array.isArray(
                direct.edges
            )
        ) {
            return direct;
        }

        const root =
            data?.data ||
            data;

        const stack = [root];
        const seen = new Set();

        while (
            stack.length
        ) {
            const o =
                stack.pop();

            if (
                !o ||
                typeof o !== 'object' ||
                seen.has(o)
            ) {
                continue;
            }

            seen.add(o);

            if (
                Array.isArray(o.edges) &&
                o.page_info
            ) {
                return o;
            }

            for (
                const v
                of Object.values(o)
            ) {
                if (
                    v &&
                    typeof v === 'object'
                ) {
                    stack.push(v);
                }
            }
        }

        return null;
    }

    function edgeNode(e) {
        let n =
            e?.node ||
            e ||
            {};

        if (
            n?.media &&
            typeof n.media === 'object'
        ) {
            n = n.media;
        }

        return n;
    }

    function gridConn(data) {
        return keyedConnection(data, GRID_CONNECTION_KEY) ||
            connection(data, GRID_CONNECTION_KEY);
    }
    function reelConn(data) {
        return keyedConnection(data, REEL_CONNECTION_KEY) ||
            connection(data, REEL_CONNECTION_KEY);
    }
    function taggedConn(data) {
        // Generic recursive "any edges" is not TAGGED evidence. GraphQL
        // payloads can contain unrelated connections or partial errors.
        return keyedConnection(data, TAGGED_CONNECTION_KEY);
    }

    function captureTagged(data, meta, now = Date.now()) {
        if (!data || (Array.isArray(data.errors) && data.errors.length)) {
            return false;
        }
        const conn = keyedConnection(data, TAGGED_CONNECTION_KEY);
        if (!conn || !Array.isArray(conn.edges) ||
            typeof conn.page_info?.has_next_page !== 'boolean') {
            return false;
        }
        const v = meta?.variables;
        if (!v || typeof v !== 'object') return false;
        const uid = String(
            v.user_id ?? v.data?.user_id ?? v.target_user_id ?? ''
        ).split('_')[0];
        if (!/^\d+$/.test(uid)) return false;

        // A continuation cannot serve as an initial-page snapshot.
        const after = v.after ?? v.data?.after ?? null;
        if (after !== null && after !== '') return false;
        let variables;
        try {
            variables = JSON.parse(JSON.stringify(v));
        } catch {
            return false;
        }
        const docId = /^\d+$/.test(String(meta?.docId || ''))
            ? String(meta.docId) : '';
        net.taggedNativeByUserId.set(uid, {
            uid, data, variables, docId,
            friendly: String(meta?.friendly || ''),
            capturedAt: Number(now),
        });
        net.taggedBootstrapConsumedByUserId.delete(uid);
        return true;
    }

    function highlightTrayConn(data) {
        const direct =
            data?.data?.highlights ||
            data?.highlights ||
            null;

        if (
            direct &&
            Array.isArray(direct.edges)
        ) {
            return direct;
        }

        return keyedConnection(
            data,
            HIGHLIGHT_TRAY_CONNECTION_KEY
        );
    }
    function storyReelRoot(data) {
        return (
            data?.data?.[STORY_REEL_ROOT_KEY] ||
            data?.[STORY_REEL_ROOT_KEY] ||
            null
        );
    }
    function parseReq(
        url,
        method,
        body,
        requestHeaders = {}
    ) {
        try {
            const u =
                String(url || '');

            if (
                !u.includes(
                    '/graphql/query'
                ) &&
                !u.includes(
                    '/api/graphql'
                )
            ) {
                return null;
            }

            if (
                String(
                    method || 'GET'
                ).toUpperCase() !==
                'POST'
            ) {
                return null;
            }

            const text =
                typeof body === 'string'
                    ? body
                    : body instanceof URLSearchParams
                        ? body.toString()
                        : '';

            if (!text) {
                return null;
            }

            const p =
                new URLSearchParams(text);

            const friendly =
                p.get(
                    'fb_api_req_friendly_name'
                ) ||
                requestHeaders[
                    'x-fb-friendly-name'
                ] ||
                '';

            let variables = {};

            try {
                variables =
                    JSON.parse(
                        p.get('variables') ||
                        '{}'
                    );
            }

            catch {}

            return {
                friendly,
                variables,
                docId:
                    String(
                        p.get('doc_id') ||
                        ''
                    ),
                endpoint:
                    u.includes('/api/graphql')
                        ? 'api'
                        : 'query',
                fbDtsg:
                    String(
                        p.get('fb_dtsg') ||
                        ''
                    ),
                lsd:
                    String(
                        p.get('lsd') ||
                        ''
                    ),
                jazoest:
                    String(
                        p.get('jazoest') ||
                        ''
                    ),
                bloksVersionId:
                    String(
                        requestHeaders['x-bloks-version-id'] ||
                        ''
                    ),
                bodyFields:
                    Object.fromEntries(
                        p.entries()
                    ),
                relayHeaders: {
                    'x-fb-lsd':
                        String(
                            requestHeaders['x-fb-lsd'] ||
                            ''
                        ),
                    'x-fb-friendly-name':
                        String(
                            requestHeaders['x-fb-friendly-name'] ||
                            ''
                        ),
                    'x-bloks-version-id':
                        String(
                            requestHeaders['x-bloks-version-id'] ||
                            ''
                        ),
                    'x-root-field-name':
                        String(
                            requestHeaders['x-root-field-name'] ||
                            ''
                        ),
                },
            };
        }

        catch {
            return null;
        }
    }

    function captureRelayContract(meta) {
        if (!meta) {
            return;
        }

        if (meta.fbDtsg) {
            net.relayFbDtsg =
                String(meta.fbDtsg);
        }

        if (meta.lsd) {
            net.relayLsd =
                String(meta.lsd);
        }

        if (meta.jazoest) {
            net.relayJazoest =
                String(meta.jazoest);
        }

        if (meta.bloksVersionId) {
            net.relayBloksVersionId =
                String(meta.bloksVersionId);
        }

        const endpoint =
            meta.endpoint === 'api'
                ? 'api'
                : 'query';

        if (
            meta.bodyFields &&
            typeof meta.bodyFields === 'object'
        ) {
            try {
                net.relayTemplates[endpoint] = {
                    body:
                        JSON.parse(
                            JSON.stringify(
                                meta.bodyFields
                            )
                        ),
                    headers:
                        JSON.parse(
                            JSON.stringify(
                                meta.relayHeaders ||
                                {}
                            )
                        ),
                };
            }
            catch {}
        }
    }

    function gridUser(meta) {
        const explicitUser =
            cleanUser(
                meta?.variables?.username ||
                meta?.variables?.data?.username ||
                ''
            )
                .toLowerCase();

        if (explicitUser) {
            return explicitUser;
        }

        return requestTargetsCurrentProfile(
            meta
        )
            ? cleanUser(
                state.username
            )
                .toLowerCase()
            : '';
    }

    function reelUserId(meta) {
        return String(
            meta
                ?.variables
                ?.data
                ?.target_user_id ||
            meta
                ?.variables
                ?.target_user_id ||
            ''
        )
            .split('_')[0];
    }

    function captureGrid(
        data,
        meta
    ) {
        const knownFriendly = GRID_NAMES.has(String(meta?.friendly || ''));
        // Instagram can rename persisted queries without changing the
        // actual response contract. Trust a newly named query ONLY when
        // its response contains the exact timeline connection key and
        // the native request is explicitly scoped to this profile.
        const exactTimelineConnection = !!keyedConnection(
            data, GRID_CONNECTION_KEY
        );
        if (
            (!knownFriendly && !exactTimelineConnection) ||
            !requestTargetsCurrentProfile(meta)
        ) return;

        const user =
            gridUser(meta);

        if (!user) {
            return;
        }

        const c = gridConn(data);
        if (
            !c ||
            (Array.isArray(data?.errors) && data.errors.length)
        ) return;

        const variables = meta?.variables || {};
        const isRoot =
            Object.prototype.hasOwnProperty.call(variables,'after');
        const isNested =
            !isRoot &&
            variables.data &&
            Object.prototype.hasOwnProperty.call(variables.data,'after');
        const cursorLocation = isRoot ? 'root' :
            isNested ? 'nested' : 'absent';
        const cursor = isRoot ? variables.after :
            isNested ? variables.data.after : null;

        // Only successful real browser traffic reaches this
        // observer. Store safe structural evidence separately
        // from request bodies, cookies and tokens.
        const audit = net.gridNativeAuditByUser.get(user) || {
            initial:0, continuation:0,
            cursorLocation:'absent', lastHasNext:'unknown',
        };
        if (cursor) audit.continuation++;
        else audit.initial++;
        audit.cursorLocation = cursorLocation;
        audit.lastHasNext = c?.page_info?.has_next_page === true
            ? 'true' : c?.page_info?.has_next_page === false
                ? 'false' : 'unknown';
        net.gridNativeAuditByUser.set(user,audit);

        const map =
            net.gridByUser.get(user) ||
            new Map();

        for (
            const e
            of c.edges || []
        ) {
            const n =
                edgeNode(e);

            const k =
                normalizePk(n) ||
                String(
                    n?.code ||
                    n?.shortcode ||
                    ''
                );

            if (k) {
                map.set(
                    String(k),
                    n
                );
            }
        }

        net.gridByUser.set(
            user,
            map
        );

        net.gridPageInfo.set(
            user,
            c.page_info || null
        );
        net.gridCaptureSeenAtByUser.set(user, Date.now());

        if (meta?.docId) {
            net.gridDocByUser.set(
                user,
                String(meta.docId)
            );
            // Store the exact contract of a successful native
            // request targeted to this profile.
            if (
                meta.variables &&
                typeof meta.variables === 'object' &&
                (knownFriendly || exactTimelineConnection)
            ) {
                try {
                    const verifiedContract = {
                        docId:String(meta.docId),
                        friendly:String(meta.friendly),
                        endpoint:meta.endpoint === 'api' ? 'api' : 'query',
                        timelineKeyVerified: exactTimelineConnection,
                        variables:JSON.parse(JSON.stringify(meta.variables)),
                        template:{
                            body:JSON.parse(JSON.stringify(meta.bodyFields || {})),
                            headers:JSON.parse(JSON.stringify(meta.relayHeaders || {})),
                        },
                    };
                    net.gridQueryByUser.set(user,verifiedContract);

                    if (cursor) {
                        // Keep native continuation schema distinct
                        // from the native first-page request schema.
                        net.gridNativeContinuationByUser.set(
                            user,verifiedContract
                        );
                    }
                    else {
                        net.gridNativeInitialByUser.set(
                            user,verifiedContract
                        );
                    }
                }
                catch {
                    net.gridQueryByUser.delete(user);
                }
            }
        }
    }

    function reelNativeCursorField(variables) {
        if (!variables || typeof variables !== 'object') return null;

        const candidates = [];
        for (const [parent, object] of [
            ['', variables],
            ['data.', variables.data],
        ]) {
            if (!object || typeof object !== 'object') continue;

            for (const key of ['after', 'max_id']) {
                if (Object.prototype.hasOwnProperty.call(object, key)) {
                    const value = object[key];
                    if (typeof value !== 'string' && typeof value !== 'number') {
                        return null;
                    }
                    candidates.push({
                        path: parent + key,
                        value: String(value),
                    });
                }
            }
        }

        // Two observed pagination fields are ambiguous. Never guess one.
        return candidates.length === 1 ? candidates[0] : null;
    }

    function captureReels(data, meta) {
        // A REELS response without a request targeting the current profile
        // must never contribute pagination proof for this profile.
        if (
            !REEL_NAMES.has(String(meta?.friendly || '')) ||
            !requestTargetsCurrentProfile(meta) ||
            (Array.isArray(data?.errors) && data.errors.length)
        ) return;

        const uid = reelUserId(meta) || String(state.userId || '');
        if (!uid || uid !== String(state.userId || '')) return;

        const c = reelConn(data);
        if (!c || !Array.isArray(c.edges)) return;

        const variables = meta?.variables;
        const cursor = reelNativeCursorField(variables);
        const isContinuation = !!cursor?.value;

        // A fresh initial page replaces older passive observations of this
        // profile. Never combine roots from independent browser page loads.
        const map = isContinuation
            ? (net.reelsByUserId.get(uid) || new Map())
            : new Map();
        for (const e of c.edges) {
            const n = edgeNode(e);
            const k = normalizePk(n) ||
                String(n?.code || n?.shortcode || '');
            if (k) map.set(String(k), n);
        }

        net.reelsByUserId.set(uid, map);
        net.reelPageInfo.set(uid, c.page_info || null);
        net.reelCaptureSeenAtByUserId.set(uid, Date.now());
        // A newly observed initial request is fresh evidence for one scan.
        if (!isContinuation) {
            net.reelBootstrapConsumedByUserId.delete(uid);
        }

        const audit = net.reelNativeAuditByUserId.get(uid) || {
            initial:0, continuation:0, cursorPath:'',
            lastHasNext:'unknown',
        };
        if (isContinuation) {
            audit.continuation++;
            audit.cursorPath = cursor.path;
        }
        else {
            audit.initial++;
        }
        audit.lastHasNext = c.page_info?.has_next_page === false
            ? 'false' : c.page_info?.has_next_page === true
                ? 'true' : 'unknown';
        net.reelNativeAuditByUserId.set(uid, audit);

        // Save only the parameters of successfully observed, target-scoped
        // native traffic. Static REEL_FALLBACK_DOC is not completion proof.
        if (
            !/^\d+$/.test(String(meta?.docId || '')) ||
            !variables ||
            typeof variables !== 'object' ||
            !meta.bodyFields ||
            typeof meta.bodyFields !== 'object'
        ) return;

        try {
            const contract = {
                docId:String(meta.docId),
                friendly:String(meta.friendly),
                endpoint:meta.endpoint === 'api' ? 'api' : 'query',
                variables:JSON.parse(JSON.stringify(variables)),
                template:{
                    body:JSON.parse(JSON.stringify(meta.bodyFields)),
                    headers:JSON.parse(JSON.stringify(meta.relayHeaders || {})),
                },
                cursorPath:isContinuation ? cursor.path : '',
            };

            if (isContinuation) {
                net.reelNativeContinuationByUserId.set(uid, contract);
            }
            else {
                net.reelNativeInitialByUserId.set(uid, contract);
            }
        }
        catch {
            if (isContinuation) net.reelNativeContinuationByUserId.delete(uid);
            else net.reelNativeInitialByUserId.delete(uid);
        }
    }

    function installHooks() {
        try {
            net.nativeFetch =
                window.fetch.bind(window);

            const original =
                window.fetch;

            window.fetch =
                function (
                    input,
                    init
                ) {
                    let meta = null;
                    let metaPromise = null;

                    try {
                        const url =
                            typeof input === 'string'
                                ? input
                                : (
                                    input?.url ||
                                    ''
                                );

                        const method =
                            init?.method ||
                            input?.method ||
                            'GET';

                        const requestHeaders = {};

                        try {
                            for (
                                const [k, v]
                                of new Headers(
                                    init?.headers ||
                                    input?.headers ||
                                    {}
                                )
                            ) {
                                requestHeaders[
                                    k.toLowerCase()
                                ] = v;
                            }
                        }

                        catch {}

                        const body =
                            typeof init?.body ===
                                'string'
                                ? init.body
                                : init?.body instanceof
                                    URLSearchParams
                                    ? init.body.toString()
                                    : '';

                        if (body) {
                            meta =
                                parseReq(
                                    url,
                                    method,
                                    body,
                                    requestHeaders
                                );
                        }

                        else if (
                            input instanceof
                            Request
                        ) {
                            metaPromise =
                                input
                                    .clone()
                                    .text()
                                    .then(
                                        t =>
                                            parseReq(
                                                url,
                                                method,
                                                t,
                                                requestHeaders
                                            )
                                    )
                                    .catch(
                                        () => null
                                    );
                        }
                    }

                    catch {}

                    const promise =
                        original.apply(
                            this,
                            arguments
                        );

                    const inspect =
                        m => {
                            if (!m) {
                                return;
                            }

                            captureRelayContract(m);

                            if (
                                HIGHLIGHT_TRAY_NAMES.has(m.friendly) &&
                                m.docId
                            ) {
                                net.highlightTrayDoc =
                                    String(m.docId);
                                net.highlightTrayFriendly =
                                    String(m.friendly);

                                net.highlightTrayEndpoint =
                                    String(
                                        m.endpoint ||
                                        'api'
                                    );

                                if (
                                    m.variables &&
                                    typeof m.variables === 'object'
                                ) {
                                    try {
                                        net.highlightTrayVariables =
                                            JSON.parse(
                                                JSON.stringify(
                                                    m.variables
                                                )
                                            );
                                    }
                                    catch {}
                                }
                            }

                            if (
                                STORY_REEL_NAMES.has(m.friendly) &&
                                m.docId
                            ) {
                                net.storyReelDoc =
                                    String(m.docId);
                            }

                            const knownProfileQuery =
                                GRID_NAMES.has(m.friendly) ||
                                REEL_NAMES.has(m.friendly);

                            if (!knownProfileQuery && !currentProfile()) {
                                return;
                            }

                            Promise
                                .resolve(promise)
                                .then(async r => {
                                    const text = await r.clone().text();

                                    if (Number(r.status || 0) === 429) {
                                        rateLimitCircuitBreak(
                                            `Native ${m.friendly}: Instagram returned HTTP 429.`
                                        );
                                        return null;
                                    }

                                    if (feedbackRequiredIn(text)) {
                                        feedbackCircuitBreak(
                                            `Native ${m.friendly}: Instagram returned feedback_required.`
                                        );
                                        return null;
                                    }
                                    if (instagramAuthChallengeIn(text)) {
                                        apiUnhealthyError(
                                            `Native ${m.friendly}: authentication/checkpoint required.`
                                        );
                                        return null;
                                    }

                                    try {
                                        return JSON.parse(text);
                                    }
                                    catch {
                                        if (
                                            Number(r.status || 0) === 200 &&
                                            knownProfileQuery
                                        ) {
                                            apiUnhealthyError(
                                                `Native ${m.friendly}: Instagram returned HTTP 200 non-JSON.`
                                            );
                                        }

                                        return null;
                                    }
                                })
                                .then(
                                    data => {
                                        if (!data) {
                                            return;
                                        }

                                        const hasGridConnection =
                                            !!keyedConnection(data, GRID_CONNECTION_KEY);
                                        const hasReelConnection =
                                            !!keyedConnection(data, REEL_CONNECTION_KEY);
                                        const hasTaggedConnection =
                                            !!keyedConnection(data, TAGGED_CONNECTION_KEY);
                                        const hasHighlightTray =
                                            !!highlightTrayConn(data);
                                        const targetsProfile =
                                            requestTargetsCurrentProfile(m);

                                        if (
                                            HIGHLIGHT_TRAY_NAMES.has(m.friendly) &&
                                            hasHighlightTray &&
                                            targetsProfile
                                        ) {
                                            net.highlightTrayData =
                                                data;
                                            net.highlightTrayUserId =
                                                String(state.userId || '');
                                        }

                                        if (hasTaggedConnection) {
                                            captureTagged(data, m);
                                        }

                                        if (
                                            GRID_NAMES.has(m.friendly) ||
                                            (hasGridConnection && targetsProfile)
                                        ) {
                                            captureGrid(data, m);
                                        }

                                        if (
                                            REEL_NAMES.has(m.friendly) ||
                                            (hasReelConnection && targetsProfile)
                                        ) {
                                            captureReels(data, m);
                                        }
                                    }
                                )
                                .catch(
                                    () => {}
                                );
                        };

                    inspect(meta);

                    if (metaPromise) {
                        metaPromise
                            .then(inspect)
                            .catch(
                                () => {}
                            );
                    }

                    return promise;
                };
        }

        catch (e) {
            console.warn(
                `[${APP.NAME}] fetch hook failed`,
                e
            );
        }

        try {
            const p =
                XMLHttpRequest.prototype;

            if (p.__jkl) {
                return;
            }

            const open =
                p.open;

            const send =
                p.send;

            const set =
                p.setRequestHeader;

            p.open =
                function (m, u) {
                    this.__m = m;
                    this.__u = u;
                    this.__h = {};

                    return open.apply(
                        this,
                        arguments
                    );
                };

            p.setRequestHeader =
                function (k, v) {
                    (
                        this.__h ||= {}
                    )[
                        String(k)
                            .toLowerCase()
                    ] =
                        String(v);

                    return set.apply(
                        this,
                        arguments
                    );
                };

            p.send =
                function (body) {
                    const meta =
                        parseReq(
                            this.__u,
                            this.__m,
                            body,
                            this.__h || {}
                        );

                    if (meta) {
                        captureRelayContract(meta);
                    }

                    if (
                        meta &&
                        HIGHLIGHT_TRAY_NAMES.has(meta.friendly) &&
                        meta.docId
                    ) {
                        net.highlightTrayDoc =
                            String(meta.docId);
                        net.highlightTrayFriendly =
                            String(meta.friendly);

                        net.highlightTrayEndpoint =
                            String(
                                meta.endpoint ||
                                'api'
                            );

                        if (
                            meta.variables &&
                            typeof meta.variables === 'object'
                        ) {
                            try {
                                net.highlightTrayVariables =
                                    JSON.parse(
                                        JSON.stringify(
                                            meta.variables
                                        )
                                    );
                            }
                            catch {}
                        }
                    }

                    if (
                        meta &&
                        STORY_REEL_NAMES.has(meta.friendly) &&
                        meta.docId
                    ) {
                        net.storyReelDoc =
                            String(meta.docId);
                    }

                    if (
                        meta &&
                        (
                            GRID_NAMES.has(meta.friendly) ||
                            REEL_NAMES.has(meta.friendly) ||
                            HIGHLIGHT_TRAY_NAMES.has(meta.friendly) ||
                            currentProfile()
                        )
                    ) {
                        this.addEventListener(
                            'load',
                            () => {
                                try {
                                    const raw =
                                        this.responseType === 'json' && this.response
                                            ? this.response
                                            : String(this.responseText || '');

                                    if (Number(this.status || 0) === 429) {
                                        rateLimitCircuitBreak(
                                            `Native ${meta.friendly}: Instagram returned HTTP 429.`
                                        );
                                        return;
                                    }

                                    if (feedbackRequiredIn(raw)) {
                                        feedbackCircuitBreak(
                                            `Native ${meta.friendly}: Instagram returned feedback_required.`
                                        );
                                        return;
                                    }
                                    if (instagramAuthChallengeIn(raw)) {
                                        apiUnhealthyError(
                                            `Native ${meta.friendly}: authentication/checkpoint required.`
                                        );
                                        return;
                                    }

                                    let data;

                                    if (typeof raw === 'string') {
                                        try {
                                            data = JSON.parse(raw);
                                        }
                                        catch {
                                            const knownProfileQuery =
                                                GRID_NAMES.has(meta.friendly) ||
                                                REEL_NAMES.has(meta.friendly);

                                            if (
                                                Number(this.status || 0) === 200 &&
                                                knownProfileQuery
                                            ) {
                                                apiUnhealthyError(
                                                    `Native ${meta.friendly}: Instagram returned HTTP 200 non-JSON.`
                                                );
                                            }

                                            return;
                                        }
                                    }
                                    else {
                                        data = raw;
                                    }

                                    const hasGridConnection =
                                        !!keyedConnection(data, GRID_CONNECTION_KEY);
                                    const hasReelConnection =
                                        !!keyedConnection(data, REEL_CONNECTION_KEY);
                                    const hasTaggedConnection =
                                        !!keyedConnection(data, TAGGED_CONNECTION_KEY);
                                    const hasHighlightTray =
                                        !!highlightTrayConn(data);
                                    const targetsProfile =
                                        requestTargetsCurrentProfile(meta);

                                    if (
                                        HIGHLIGHT_TRAY_NAMES.has(meta.friendly) &&
                                        hasHighlightTray &&
                                        targetsProfile
                                    ) {
                                        net.highlightTrayData =
                                            data;
                                        net.highlightTrayUserId =
                                            String(state.userId || '');
                                    }

                                    if (hasTaggedConnection) {
                                        captureTagged(data, meta);
                                    }

                                    if (
                                        GRID_NAMES.has(meta.friendly) ||
                                        (hasGridConnection && targetsProfile)
                                    ) {
                                        captureGrid(data, meta);
                                    }

                                    if (
                                        REEL_NAMES.has(meta.friendly) ||
                                        (hasReelConnection && targetsProfile)
                                    ) {
                                        captureReels(data, meta);
                                    }
                                }

                                catch {}
                            },
                            {
                                once: true,
                            }
                        );
                    }

                    return send.apply(
                        this,
                        arguments
                    );
                };

            Object.defineProperty(
                p,
                '__jkl',
                {
                    value: true,
                }
            );
        }

        catch (e) {
            console.warn(
                `[${APP.NAME}] XHR hook failed`,
                e
            );
        }
    }

    installHooks();

    function headers(extra = {}) {
        const h = {
            Accept: '*/*',
            'X-IG-App-ID':
                APP.APP_ID,
            'X-ASBD-ID':
                APP.ASBD_ID,
            'X-Requested-With':
                'XMLHttpRequest',
            'X-CSRFToken':
                cookie('csrftoken'),
            ...extra,
        };

        for (
            const k
            of Object.keys(h)
        ) {
            if (!h[k]) {
                delete h[k];
            }
        }

        return h;
    }

    function summarizeJsonEndpointResponse(response, payload) {
        // Diagnostics deliberately avoid response bodies, URLs with
        // query parameters, cookies, tokens and session identifiers.
        const rawType = String(
            response?.headers?.get?.('content-type') || ''
        ).toLowerCase().split(';')[0].trim();
        const type = /^(application\/json|text\/html|text\/plain|application\/javascript)$/.test(rawType)
            ? rawType : (rawType ? 'other' : 'unknown');

        const content = String(payload || '');
        const leading = content.trimStart().slice(0, 120);
        const bodyKind = !leading
            ? 'empty'
            : /^(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(leading)
                ? 'html'
                : /^[\[{]/.test(leading)
                    ? 'json-like'
                    : 'other';

        let destination = 'unavailable';
        try {
            const u = new URL(
                response?.url || '',
                location.origin
            );
            // Fixed categories only; no usernames or request params.
            if (
                /^\/accounts\/login(?:\/|$)/.test(u.pathname)
            ) destination = 'login';
            else if (
                /^\/(?:challenge|checkpoint)(?:\/|$)/.test(
                    u.pathname
                )
            ) destination = 'checkpoint';
            else if (u.pathname === '/') destination = 'home';
            else if (
                /^\/(?:api\/)?graphql(?:\/|$)/.test(
                    u.pathname
                )
            ) destination = 'graphql';
            else destination = 'other';
        }
        catch {}

        return (
            'type=' + type +
            ', body=' + bodyKind +
            ', destination=' + destination +
            ', redirected=' +
                (response?.redirected === true ? 'yes' : 'no')
        );
    }

    function summarizeGraphQlErrors(errors) {
        const list = Array.isArray(errors) ? errors : [];
        if (!list.length) return 'count=0, kind=none';

        const kinds = new Set();
        const codes = new Set();
        const severity = new Set();

        for (const error of list.slice(0,10)) {
            const message = String(error?.message || '');
            const kind =
                /missing_required_variable_value/i.test(message)
                    ? 'missing_required_variable'
                    : /execution error|server error|internal error/i.test(message)
                        ? 'server_execution'
                        : /invalid request|malformed variables/i.test(message)
                            ? 'invalid_request'
                            : /invalid|malformed|expired/i.test(message) &&
                                /cursor/i.test(message)
                                ? 'invalid_cursor'
                                : /throttl|rate.limit|too many/i.test(message)
                                    ? 'rate_limited'
                                    : /not authorized|unauthorized|permission/i.test(message)
                                        ? 'access_denied'
                                        : 'unclassified';
            kinds.add(kind);

            // Report numeric error category only; never log the
            // raw message, mids, fbtrace_id, debug URL or session.
            if (
                Number.isSafeInteger(error?.code) &&
                error.code >= 0 &&
                error.code <= 999999999
            ) codes.add(error.code);
            const level = String(error?.severity || '').toUpperCase();
            if (['CRITICAL','ERROR','WARNING'].includes(level)) {
                severity.add(level);
            }
        }

        return 'count=' + list.length +
            ', kind=' + [...kinds].sort().join('+') +
            ', code=' + ([...codes].sort((a,b)=>a-b).join('+') || '-') +
            ', severity=' + ([...severity].sort().join('+') || '-');
    }

    async function fetchJson(
        url,
        opt = {},
        label = 'request',
        tries = 1
    ) {
        // This transport bypasses GM, so it must share the SAME private
        // REST preflight. A rejected method must not enter the retry loop.
        const denied = unsafePrivateRestMethod(url, opt?.method || 'GET');
        if (denied) throw denied;

        let last;

        for (
            let i = 1;
            i <= tries;
            i++
        ) {
            if (
                state.cancelled
            ) {
                throw new Error(
                    'Cancelled'
                );
            }

            try {
                // Requests originating from this userscript must
                // not be mistaken for native Instagram network
                // traffic by the fetch/XHR observation layer.
                const transport =
                    net.nativeFetch ||
                    window.fetch.bind(window);

                const r =
                    await transport(
                        url,
                        {
                            credentials:
                                'include',

                            redirect:
                                'follow',

                            ...opt,

                            headers: {
                                ...headers(),
                                ...(
                                    opt.headers ||
                                    {}
                                ),
                            },
                        }
                    );

                const text =
                    await r.text();

                if (Number(r.status || 0) === 429) {
                    throw rateLimitCircuitBreak(
                        `${label}: Instagram returned HTTP 429.`
                    );
                }
                if (Number(r.status || 0) === 401) {
                    throw apiUnhealthyError(
                        `${label}: Instagram API returned HTTP 401; stopping authenticated requests.`
                    );
                }

                if (feedbackRequiredIn(text)) {
                    throw feedbackCircuitBreak(
                        `${label}: Instagram returned feedback_required.`
                    );
                }
                if (instagramAuthChallengeIn(text)) {
                    throw apiUnhealthyError(
                        `${label}: Instagram authentication/checkpoint required.`
                    );
                }

                let data =
                    null;

                try {
                    data =
                        JSON.parse(text);
                }

                catch {}

                if (
                    r.ok &&
                    Number(r.status || 0) === 200 &&
                    !data
                ) {
                    throw apiUnhealthyError(
                        `${label}: Instagram JSON endpoint returned HTTP 200 non-JSON (` +
                        `${summarizeJsonEndpointResponse(r, text)}); scan stopped.`
                    );
                }

                if (
                    !r.ok ||
                    !data
                ) {
                    const e =
                        new Error(
                            `${label}: ` +
                            `${r.status || ''} ` +
                            `${data?.message || (!data ? 'invalid JSON response' : '')}`
                                .trim()
                        );

                    e.status =
                        r.status;

                    throw e;
                }

                // A 200 response containing GraphQL errors is
                // NOT a valid empty page.
                if (Array.isArray(data?.errors) && data.errors.length) {
                    throw apiUnhealthyError(
                        label + ': Instagram GraphQL rejected the request (' +
                        summarizeGraphQlErrors(data.errors) +
                        '); scan stopped.'
                    );
                }

                if (
                    data?.status ===
                    'fail'
                ) {
                    if (feedbackRequiredIn(data)) {
                        throw feedbackCircuitBreak(
                            `${label}: Instagram returned feedback_required.`
                        );
                    }

                    throw new Error(
                        `${label}: ` +
                        `${data?.message || 'failed'}`
                    );
                }

                return data;
            }

            catch (e) {
                last = e;
                throwIfInstagramStop(e, label);

                if (i >= tries) {
                    break;
                }

                await sleep(
                    1200 *
                    i *
                    i +
                    rand(0, 500)
                );
            }
        }

        throw (
            last ||
            new Error(
                `${label}: failed`
            )
        );
    }

    async function gql(
        doc,
        variables,
        name
    ) {
        const b =
            new URLSearchParams();

        b.set(
            'variables',
            JSON.stringify(
                variables
            )
        );

        b.set(
            'doc_id',
            doc
        );

        b.set(
            'fb_api_caller_class',
            'RelayModern'
        );

        b.set(
            'server_timestamps',
            'true'
        );

        if (name) {
            b.set(
                'fb_api_req_friendly_name',
                name
            );
        }

        return fetchJson(
            'https://www.instagram.com/graphql/query',
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/x-www-form-urlencoded;charset=UTF-8',
                },

                body: b,
            },

            `GraphQL ${name || doc}`,
            1
        );
    }

    function relayJazoest(fbDtsg) {
        return (
            '2' +
            [...String(fbDtsg || '')]
                .reduce(
                    (sum, ch) =>
                        sum +
                        ch.charCodeAt(0),
                    0
                )
        );
    }

    async function webRelayGql(
        doc,
        variables,
        name,
        options = {}
    ) {
        const endpointKey =
            options.endpoint === 'api'
                ? 'api'
                : 'query';

        const template =
            options.nativeTemplate ||
            net.relayTemplates[
                endpointKey
            ];

        const templateBody =
            template?.body &&
            typeof template.body === 'object'
                ? template.body
                : {};

        const b =
            new URLSearchParams();

        for (
            const [key, value]
            of Object.entries(
                templateBody
            )
        ) {
            if (
                value != null &&
                String(value) !== ''
            ) {
                b.set(
                    key,
                    String(value)
                );
            }
        }

        const fbDtsg =
            String(
                b.get('fb_dtsg') ||
                net.relayFbDtsg ||
                ''
            );

        if (!fbDtsg) {
            throw new Error(
                `GraphQL ${name}: native Relay contract missing fb_dtsg; refusing approximate request.`
            );
        }

        b.set(
            'fb_dtsg',
            fbDtsg
        );

        const actor =
            cookie('ds_user_id');

        if (
            actor &&
            !b.get('av')
        ) {
            b.set(
                'av',
                actor
            );
        }

        if (!b.get('__d')) {
            b.set('__d', 'www');
        }

        if (!b.get('__a')) {
            b.set('__a', '1');
        }

        const lsd =
            String(
                b.get('lsd') ||
                net.relayLsd ||
                ''
            );

        if (lsd) {
            b.set(
                'lsd',
                lsd
            );
        }

        if (!b.get('jazoest')) {
            b.set(
                'jazoest',
                net.relayJazoest ||
                relayJazoest(
                    fbDtsg
                )
            );
        }

        b.set(
            'fb_api_caller_class',
            'RelayModern'
        );
        b.set(
            'fb_api_req_friendly_name',
            name
        );
        b.set(
            'server_timestamps',
            'true'
        );
        b.set(
            'doc_id',
            String(doc)
        );
        b.set(
            'variables',
            JSON.stringify(
                variables
            )
        );

        const requestHeaders = {
            'Content-Type':
                'application/x-www-form-urlencoded',
            'X-FB-Friendly-Name':
                name,
        };

        const templateHeaders =
            template?.headers ||
            {};

        const nativeLsd =
            String(
                templateHeaders['x-fb-lsd'] ||
                lsd ||
                ''
            );

        if (nativeLsd) {
            requestHeaders['X-FB-LSD'] =
                nativeLsd;
        }

        if (endpointKey === 'query') {
            const bloks =
                String(
                    templateHeaders['x-bloks-version-id'] ||
                    net.relayBloksVersionId ||
                    ''
                );

            if (bloks) {
                requestHeaders['X-Bloks-Version-Id'] =
                    bloks;
            }

            if (options.rootField) {
                requestHeaders['X-Root-Field-Name'] =
                    String(
                        options.rootField
                    );
            }
        }
        else {
            // Native /api/graphql can include a root-field header.
            // Preserve it when actually observed; never synthesize
            // one from a guessed connection key on this endpoint.
            const nativeRootField = String(
                templateHeaders['x-root-field-name'] || ''
            );
            if (nativeRootField) {
                requestHeaders['X-Root-Field-Name'] =
                    nativeRootField;
            }
        }

        const endpoint =
            endpointKey === 'api'
                ? 'https://www.instagram.com/api/graphql'
                : 'https://www.instagram.com/graphql/query';

        return fetchJson(
            endpoint,
            {
                method: 'POST',
                headers:
                    requestHeaders,
                body: b,
            },
            `GraphQL ${name}`,
            1
        );
    }

    function parseCount(raw) {
        let s =
            String(raw || '')
                .trim()
                .toLowerCase()
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, '');

        if (!s) {
            return 0;
        }

        let mult = 1;

        if (/[km]$/.test(s)) {
            mult =
                s.endsWith('k')
                    ? 1e3
                    : 1e6;

            s =
                s.slice(0, -1);
        }

        if (
            s.includes(',') &&
            !s.includes('.')
        ) {
            s =
                s.replace(',', '.');
        }

        else {
            s =
                s.replace(/,/g, '');
        }

        const n =
            Number(s);

        return Number.isFinite(n)
            ? Math.round(
                n * mult
            )
            : 0;
    }

    function domCount() {
        try {
            const t =
                String(
                    document
                        .querySelector('main')
                        ?.innerText ||
                    document.body
                        ?.innerText ||
                    ''
                );

            const m =
                t.match(
                    /([\d\s.,]+\s*[kKmM]?)\s*(?:publications?|posts?)\b/i
                );

            return m
                ? parseCount(m[1])
                : 0;
        }

        catch {
            return 0;
        }
    }

    function profileMetadataFromHtml(html, username, finalUrl) {
        const wanted = cleanUser(username).toLowerCase();
        if (!wanted || !html || !finalUrl) return null;
        let page;
        try {
            page = new URL(finalUrl, location.origin);
        }
        catch { return null; }
        if (
            !/^(?:www\.)?instagram\.com$/i.test(page.hostname) ||
            page.pathname.replace(/^\/+|\/+$/g,'').toLowerCase() !== wanted
        ) return null;

        const source = String(html);
        const canonical = source.match(
            /<meta\b(?=[^>]*\bproperty\s*=\s*["']og:url["'])(?=[^>]*\bcontent\s*=\s*["']([^"']+)["'])[^>]*>/i
        )?.[1]?.replace(/&amp;/g,'&');
        if (canonical) {
            try {
                const link = new URL(canonical, location.origin);
                if (
                    !/^(?:www\.)?instagram\.com$/i.test(link.hostname) ||
                    link.pathname.replace(/^\/+|\/+$/g,'').toLowerCase() !== wanted
                ) return null;
            }
            catch { return null; }
        }

        // Never guess IDs from unrelated suggestions or comments.
        const identifiers = [
            source.match(
                /<meta\b(?=[^>]*\b(?:property|name)\s*=\s*["']instapp:owner_user_id["'])(?=[^>]*\bcontent\s*=\s*["'](\d+)["'])[^>]*>/i
            )?.[1],
            source.match(/"page_id"\s*:\s*"profilePage_(\d+)"/)?.[1],
            source.match(/"profile_id"\s*:\s*"(\d+)"/)?.[1],
        ].filter(Boolean);
        const id = String(identifiers[0] || '');
        if (!/^[1-9]\d{0,19}$/.test(id)) return null;
        return { pk:id, id, username:cleanUser(username) };
    }

    async function fetchProfilePageMetadata(username) {
        const url = 'https://www.instagram.com/' +
            encodeURIComponent(username) + '/';
        const response = await fetch(url, {
            credentials:'include',
            redirect:'follow',
            headers:{Accept:'text/html'},
        });
        const body = await response.text();
        const http = Number(response.status || 0);

        if (http === 429) {
            throw rateLimitCircuitBreak(
                'Profile HTML: Instagram returned HTTP 429.'
            );
        }
        // An HTML app shell may mention feedback_required as
        // static JavaScript; detect it only in actual API JSON.
        if (
            /^\s*[\[{]/.test(body) &&
            feedbackRequiredIn(body)
        ) {
            throw feedbackCircuitBreak(
                'Profile HTML: Instagram returned feedback_required.'
            );
        }
        if (!response.ok) {
            const error = new Error('Profile HTML: HTTP ' + http);
            error.status = http;
            if (http === 401 || http === 403) {
                error.code = 'IG_PROFILE_ACCESS';
            }
            throw error;
        }

        // A login/checkpoint redirect is an access problem,
        // not a cue to hammer an alternate Instagram API.
        const finalUrl = response.url || url;
        const final = new URL(finalUrl, location.origin);
        if (
            !/^(?:www\.)?instagram\.com$/i.test(final.hostname) ||
            final.pathname.replace(/^\/+|\/+$/g, '')
                .toLowerCase() !== cleanUser(username).toLowerCase()
        ) {
            const error = new Error(
                'Profile HTML redirected away from the requested profile; check Instagram session.'
            );
            error.code = 'IG_PROFILE_REDIRECT';
            throw error;
        }

        const info = profileMetadataFromHtml(
            body, username, finalUrl
        );
        if (!info) {
            throw new Error(
                'Profile HTML: no verified profile ID.'
            );
        }
        return info;
    }

    async function resolveProfile(username) {
        status(
            `Resolving @${username}…`
        );

        log(
            `Resolving profile @${username}`
        );

        let user = null;

        // Reuse the displayed profile metadata if present.
        if (
            currentProfile().toLowerCase() === username.toLowerCase()
        ) {
            user = profileMetadataFromHtml(
                document.documentElement.outerHTML,
                username, location.href
            );
        }

        // At most one normal HTML request, not a retired API call.
        if (!user) {
            try {
                user = await fetchProfilePageMetadata(username);
                log('Profile ID resolved from profile HTML.');
            }
            catch (e) {
                throwIfInstagramStop(e, 'Profile HTML');
                if (
                    e?.code === 'IG_PROFILE_REDIRECT' ||
                    e?.code === 'IG_PROFILE_ACCESS'
                ) {
                    throw e;
                }
                log('Profile HTML unavailable: ' + e.message, 'warn');
            }
        }

        // Last resort: a single topsearch request, no retries.
        if (!user) {
            try {
                const data = await fetchJson(
                    'https://www.instagram.com/web/search/topsearch/?query=' +
                        encodeURIComponent(username),
                    {}, 'Profile search', 1
                );
                user = (data?.users || [])
                    .map(x => x?.user || x)
                    .find(x => String(x?.username || '')
                        .toLowerCase() === username.toLowerCase()) || null;
            }
            catch (e) {
                throwIfInstagramStop(e, 'Profile search');
                log('Top search unavailable: ' + e.message, 'warn');
            }
        }

        if (!user) {
            throw new Error(
                `Unable to resolve @${username}`
            );
        }

        const id =
            String(
                user.pk ||
                user.id ||
                ''
            )
                .split('_')[0];

        if (
            !/^\d+$/.test(id)
        ) {
            throw new Error(
                'Profile user ID missing'
            );
        }

        state.username =
            username;

        state.userId =
            id;

        state.profile =
            user;

        state.expected =
            Number(
                user.media_count ||
                user
                    ?.edge_owner_to_timeline_media
                    ?.count ||
                domCount() ||
                0
            ) ||
            0;

        ui.username.value =
            username;

        ui.userInfo.textContent =
            `@${username} • ID ${id}` +
            (
                state.expected
                    ? ` • ${state.expected} publications`
                    : ''
            );

        log(
            `Resolved @${username} → ${id}` +
            (
                state.expected
                    ? ` (${state.expected} publications expected)`
                    : ''
            )
        );
    }

    async function refreshProfileInfo() {
        if (!state.userId) {
            return false;
        }

        try {
            const r = await gmRequest({
                method: 'GET',
                url: `https://www.instagram.com/api/v1/users/${state.userId}/info/`,
                feedbackLabel: 'PROFILE INFO',
                headers: {
                    Accept: '*/*',
                    'User-Agent': APP.MOBILE_UA,
                },
            });

            if (feedbackRequiredIn(r.responseText)) {
                throw feedbackCircuitBreak(
                    'PROFILE INFO: Instagram returned feedback_required.'
                );
            }

            if (Number(r.status) !== 200) {
                throw new Error(`HTTP ${r.status}`);
            }

            let d;

            try {
                d = JSON.parse(r.responseText);
            }
            catch {
                if (Number(r.status || 0) === 200) {
                    throw apiUnhealthyError(
                        'PROFILE INFO: Instagram returned HTTP 200 non-JSON; scan stopped.'
                    );
                }

                throw new Error('invalid JSON response');
            }

            if (d?.status !== 'ok' || !d?.user) {
                throw new Error(d?.message || 'invalid user payload');
            }

            const u = d.user;
            const fc = u?.fan_club_info || {};

            state.profileInfo = u;
            state.profile = {
                ...(state.profile || {}),
                ...u,
            };

            const count = Number(u?.media_count || 0);

            if (Number.isFinite(count) && count > 0) {
                state.expected = count;
            }

            state.exclusive.known = true;
            state.exclusive.hasExclusiveFeedContent =
                u?.has_exclusive_feed_content === true;
            state.exclusive.fanClubId = String(fc?.fan_club_id || '');
            state.exclusive.subscriberCount =
                Number.isFinite(Number(fc?.subscriber_count))
                    ? Number(fc.subscriber_count)
                    : null;
            state.exclusive.autosaveExclusiveHighlight =
                fc?.autosave_to_exclusive_highlight === true;
            state.exclusive.postsStatus = String(u?.posts_subscription_status || '');
            state.exclusive.reelsStatus = String(u?.reels_subscription_status || '');
            state.exclusive.storiesStatus = String(u?.stories_subscription_status || '');
            state.exclusive.liveStatus = String(u?.live_subscription_status || '');

            ui.userInfo.textContent =
                `@${state.username} • ID ${state.userId}` +
                (state.expected ? ` • global ${state.expected}` : '') +
                (state.exclusive.hasExclusiveFeedContent ? ' • exclusive feed' : '');

            log(
                `Profile API: global=${state.expected || '?'}, ` +
                `private=${u?.is_private === true ? 'YES' : 'NO'}, ` +
                `exclusive=${state.exclusive.hasExclusiveFeedContent ? 'YES' : 'NO'}, ` +
                `fan_club_id=${state.exclusive.fanClubId || '-'}, ` +
                `subscribers=${state.exclusive.subscriberCount ?? '-'}, ` +
                `total_clips_count=${u?.total_clips_count ?? '-'}, ` +
                `has_clips=${typeof u?.has_clips === 'boolean' ? u.has_clips : '-'}, ` +
                `has_any_clips=${typeof u?.has_any_clips === 'boolean' ? u.has_any_clips : '-'}, ` +
                `latest_story_timestamp=${u?.latest_reel_media == null ? '-' : (
                    u.latest_reel_media === 0 || u.latest_reel_media === '0' ||
                    u.latest_reel_media === false || u.latest_reel_media === ''
                        ? 'empty-sentinel' : 'present-' + typeof u.latest_reel_media
                )}.`
            );

            return true;
        }
        catch (e) {
            state.exclusive.known = false;
            throwIfInstagramStop(e, 'PROFILE INFO: Instagram returned feedback_required.');

            log(
                `Profile API info unavailable: ${e.message}`,
                'warn'
            );

            return false;
        }
    }

    function ownedIds() {
        return new Set([
            ...state.roots.POST,
            ...state.roots.REEL,
        ]);
    }

    function ownedCount() {
        return ownedIds().size;
    }

    function registerOwnedRootMembership(
        rootId,
        type
    ) {
        const id =
            String(
                rootId ||
                ''
            );

        if (!id) {
            return;
        }

        if (type === 'REEL') {
            /*
             * REEL membership is stronger evidence than the default
             * classification of the mixed PROFILE grid. Once an ID is
             * confirmed by the REELS surface, keep the owned root sets
             * mutually exclusive and never count it again as a POST.
             */
            state.roots.REEL.add(
                id
            );

            state.roots.POST.delete(
                id
            );

            return;
        }

        if (
            type === 'POST' &&
            !state.roots.REEL.has(id)
        ) {
            state.roots.POST.add(
                id
            );
        }
    }

    function ownedDiscoveryCoverage(
        plan = scanSelection()
    ) {
        const guards = [];

        if (plan?.post) {
            guards.push(
                'profileGrid',
                'publicShadow'
            );
        }

        if (
            plan?.post ||
            plan?.reel
        ) {
            guards.push(
                'connectedHidden'
            );
        }

        if (plan?.reel) {
            guards.push(
                'reels'
            );
        }

        const total =
            guards.length;

        const completed =
            guards.filter(
                key =>
                    state.coverage[key] === true ||
                    (key === 'reels' && reelsSurfaceSkipped()) ||
                    (key === 'profileGrid' && profileSurfaceOperationalSkip())
            )
                .length;

        const ratio =
            total > 0
                ? completed / total
                : 0;

        return {
            guards,
            completed,
            total,
            ratio:
                Math.min(
                    1,
                    Math.max(
                        0,
                        ratio
                    )
                ),
            complete:
                total > 0 &&
                completed === total,
        };
    }

    function updateStats() {
        if (!ui.stats) {
            return;
        }

        let existing = 0;
        let pending = 0;
        let indexedMatched = 0;
        let sessionMatched = 0;
        let legacyMatched = 0;
        let hiddenTotal = 0;
        let hiddenExisting = 0;

        for (const m of state.queue.values()) {
            const reason = existingReason(m);
            if (reason) {
                existing++;
                if (reason === 'DISK') indexedMatched++;
                else if (reason === 'SESSION') sessionMatched++;
                else if (reason === 'LEGACY') legacyMatched++;
            }
            else {
                pending++;
            }

            if (isHiddenMedia(m)) {
                hiddenTotal++;
                if (reason) hiddenExisting++;
            }
        }

        const hiddenMissing = Math.max(
            0,
            hiddenTotal - hiddenExisting
        );

        const files = {
            POST: 0,
            REEL: 0,
            STORY: 0,
            HIGHLIGHT: 0,
            TAGGED: 0,
            AVATAR: 0,
        };

        for (const m of state.queue.values()) {
            files[m.type] =
                (files[m.type] || 0) + 1;
        }

        const owned = ownedCount();
        const gap = globalGap();
        const expected = Math.max(
            0,
            Number(state.expected || 0)
        );

        const selectedPlan =
            scanSelection();

        const ownedDiscoverySelected =
            !!(
                selectedPlan?.post ||
                selectedPlan?.reel
            );

        const discoveryCoverage =
            ownedDiscoveryCoverage(
                selectedPlan
            );

        const discoveryPercent =
            ownedDiscoverySelected
                ? Math.round(
                    discoveryCoverage.ratio *
                    1000
                ) / 10
                : 0;

        const discoveryFill =
            ownedDiscoverySelected
                ? Math.min(
                    100,
                    discoveryCoverage.ratio *
                    100
                )
                : 0;

        const scanProgress =
            scanProgressSummary();

        const currentPhase =
            currentPhaseSummary();

        const plannedDownload =
            downloadOperationPlan();

        const dl =
            state.downloadProgress || {};

        const dlTotal = Math.max(
            0,
            Number(dl.total || 0)
        );

        const dlCompleted = Math.max(
            0,
            Number(dl.completed || 0)
        );

        const dlRatio =
            dlTotal > 0
                ? Math.min(1, dlCompleted / dlTotal)
                : 0;

        let downloadFill = 0;
        let downloadValue = '—';
        let downloadDetail = 'Idle';

        if (dl.status === 'running') {
            downloadFill = dlRatio * 100;
            downloadValue = `${Math.round(dlRatio * 1000) / 10}%`;
            downloadDetail =
                `${dlCompleted}/${dlTotal} writes` +
                (
                    dl.current
                        ? ` · ${dl.current}`
                        : ''
                );
        }
        else if (dl.status === 'cancelled') {
            downloadFill = dlRatio * 100;
            downloadValue = `${Math.round(dlRatio * 1000) / 10}%`;
            downloadDetail =
                `Cancelled · ${dlCompleted}/${dlTotal} writes processed`;
        }
        else if (dl.status === 'complete') {
            downloadFill = 100;
            downloadValue = '100%';
            downloadDetail =
                dlTotal > 0
                    ? `${dlCompleted}/${dlTotal} writes · ` +
                        `${dl.succeeded} ok · ${dl.failed} failed` +
                        (dl.blocked ? ` · ${dl.blocked} blocked` : '')
                    : 'Archive complete · no writes needed';
        }
        else if (
            state.scanComplete &&
            ['COMPLETE', 'EXPOSED_COMPLETE'].includes(state.scanOutcome)
        ) {
            if (plannedDownload.total > 0) {
                downloadValue = 'READY';
                downloadDetail =
                    `${plannedDownload.total} writes pending · ` +
                    `${plannedDownload.main} main · ` +
                    `${plannedDownload.hidden} hidden`;
            }
            else if (state.queue.size > 0) {
                downloadFill = 100;
                downloadValue = '100%';
                downloadDetail =
                    'Archive complete · no writes needed';
            }
        }
        else if (state.queue.size > 0) {
            if (state.partialDownloadGrants.accessible) {
                downloadValue = 'PARTIAL READY';
                downloadDetail =
                    state.partialDownloadGrants.accessible.mediaCount +
                    ' verified accessible media · full backup locked';
            }
            else if (state.partialDownloadGrants.subscriber) {
                downloadValue = 'SUBSCRIBER PARTIAL';
                downloadDetail =
                    state.partialDownloadGrants.subscriber.mediaCount +
                    ' verified subscriber media · full backup locked';
            }
            else {
                downloadValue = 'LOCKED';
                downloadDetail = 'Waiting for a COMPLETE scan';
            }
        }

        const missingCoverage =
            incompleteCoverage();

        const coverageText =
            !state.userId
                ? 'NOT SCANNED'
                : state.scanOutcome === 'EXPOSED_COMPLETE'
                    ? (profileSurfaceOperationalSkip()
                        ? 'EXPOSED OK · PROFILE UNPROVEN'
                        : 'EXPOSED OK · REELS SKIPPED')
                    : missingCoverage.length
                        ? 'INCOMPLETE'
                        : 'COVERAGE OK';

        const coverageClass =
            !state.userId
                ? 'neutral'
                : (
                    missingCoverage.length
                        ? 'warn'
                        : 'ok'
                );

        const diskText =
            state.diskActive
                ? 'DISK INDEXED'
                : 'SESSION ONLY';

        const diskClass =
            state.diskActive
                ? 'ok'
                : 'warn';

        const hydrationDone = Math.max(
            0,
            Number(state.hydration.hydratedRoots || 0)
        );

        const hydrationTotal = Math.max(
            0,
            Number(state.hydration.totalRoots || 0)
        );

        const diskSatisfied = Math.max(
            0,
            Number(state.hydration.diskSatisfiedRoots || 0)
        );

        const hydrationFailed = Math.max(
            0,
            Number(state.hydration.failedRoots || 0)
        );

        const apiRemaining = Math.max(
            0,
            hydrationTotal - hydrationDone - hydrationFailed
        );

        const scanCompleteNonDisk = Math.max(
            0,
            hydrationDone - diskSatisfied
        );

        const globalFill = Math.min(
            100,
            Math.max(0, scanProgress.percent)
        );

        if (ui.globalFill) {
            ui.globalFill.style.width =
                `${globalFill}%`;

            ui.globalFill.classList.toggle(
                'indeterminate',
                scanProgress.indeterminate
            );
        }

        if (ui.globalValue) {
            ui.globalValue.textContent =
                `${scanProgress.percent.toFixed(1)}%`;
        }

        if (ui.globalDetail) {
            ui.globalDetail.textContent =
                scanProgress.currentText;
        }

        if (ui.phaseLabel) {
            ui.phaseLabel.textContent =
                currentPhase.label;
        }

        if (ui.phaseFill) {
            ui.phaseFill.style.width =
                currentPhase.indeterminate
                    ? '100%'
                    : `${currentPhase.percent}%`;

            ui.phaseFill.classList.toggle(
                'indeterminate',
                currentPhase.indeterminate
            );
        }

        if (ui.phaseValue) {
            ui.phaseValue.textContent =
                currentPhase.value;
        }

        if (ui.phaseDetail) {
            ui.phaseDetail.textContent =
                currentPhase.detail;
        }

        if (ui.discoveryFill) {
            ui.discoveryFill.style.width =
                `${discoveryFill}%`;
        }

        if (ui.discoveryValue) {
            ui.discoveryValue.textContent =
                ownedDiscoverySelected
                    ? (
                        discoveryCoverage.complete &&
                        !state.running
                            ? '100%'
                            : `${discoveryPercent.toFixed(1)}%`
                    )
                    : '—';
        }

        if (ui.discoveryDetail) {
            ui.discoveryDetail.textContent =
                !ownedDiscoverySelected
                    ? 'POST/REEL not selected'
                    : (
                        `${owned} accessible owned roots` +
                        (
                            expected > 0
                                ? ` · IG counter ${expected}` +
                                    (
                                        gap > 0
                                            ? ` · gap ${gap} informational`
                                            : ''
                                    )
                                : ''
                        ) +
                        (
                            discoveryCoverage.total > 0
                                ? ` · guards ${discoveryCoverage.completed}/${discoveryCoverage.total}`
                                : ''
                        )
                    );
        }

        if (ui.downloadFill) {
            ui.downloadFill.style.width =
                `${Math.min(100, Math.max(0, downloadFill))}%`;
        }

        if (ui.downloadValue) {
            ui.downloadValue.textContent =
                downloadValue;
        }

        if (ui.downloadDetail) {
            ui.downloadDetail.textContent =
                downloadDetail;
        }

        if (ui.miniProgress) {
            ui.miniProgress.textContent =
                state.downloading
                    ? `${Math.round(downloadFill)}% DL`
                    : state.running
                        ? `${Math.round(globalFill)}%`
                        : '';
        }

        ui.stats.innerHTML = `
            <div class="jkl-metrics">
                <div class="metric">
                    <span>OWNED</span>
                    <b>${owned}</b>
                </div>

                <div class="metric">
                    <span>POSTS</span>
                    <b>${state.roots.POST.size}</b>
                </div>

                <div class="metric">
                    <span>REELS</span>
                    <b>${state.roots.REEL.size}</b>
                </div>

                <div class="metric">
                    <span>FILES</span>
                    <b>${state.queue.size}</b>
                </div>

                <div class="metric">
                    <span>HIDDEN</span>
                    <b>${hiddenTotal}</b>
                </div>

                <div class="metric">
                    <span>MISSING</span>
                    <b>${pending}</b>
                </div>
            </div>

            <div class="jkl-compact-card">
                <div class="jkl-card-head">
                    <span>HYDRATION</span>
                    <b>${hydrationDone}/${hydrationTotal || 0}</b>
                </div>

                <div class="jkl-card-line">
                    <span>Complete <b>${scanCompleteNonDisk}</b></span>
                    <span>Disk <b>${diskSatisfied}</b></span>
                    <span>Remaining <b>${apiRemaining}</b></span>
                    <span>Errors <b>${hydrationFailed}</b></span>
                </div>
            </div>

            <div class="jkl-compact-card">
                <div class="jkl-card-head">
                    <span>ARCHIVE</span>
                    <b class="jkl-state ${diskClass}">${diskText}</b>
                </div>

                <div class="jkl-card-line">
                    <span>Files <b>${state.diskActive ? state.diskIndexStats.selectedFiles : '—'}</b></span>
                    <span>IDs <b>${state.diskActive ? state.diskCanonical.size : '—'}</b></span>
                    <span>HIDDEN <b>${state.diskActive ? state.diskHidden.size : '—'}</b></span>
                    <span>Legacy <b>${state.diskActive ? state.legacy.size : '—'}</b></span>
                </div>
                <div class="jkl-card-line">
                    <span>Recognized files <b>${state.diskActive ? state.diskIndexStats.canonicalFiles + state.diskIndexStats.legacyFiles : '—'}</b></span>
                    <span>Unrecognized <b>${state.diskActive ? state.diskIndexStats.unrecognizedFiles : '—'}</b></span>
                </div>
                <div class="jkl-card-line">
                    <span>Existing <b>${existing}</b></span>
                    <span>Missing <b>${pending}</b></span>
                    <span>HIDDEN <b>${hiddenExisting}/${hiddenTotal}</b></span>
                    <span>Downloaded <b>${state.downloaded}</b></span>
                </div>
                <div class="jkl-card-line">
                    <span>Indexed matches <b>${indexedMatched}</b></span>
                    <span>Session callbacks <b>${sessionMatched}</b></span>
                    <span>Legacy matches <b>${legacyMatched}</b></span>
                </div>
            </div>
        `;

        if (ui.diagnostics) {
            const exclusiveText =
                state.exclusive.known
                    ? (
                        state.exclusive.hasExclusiveFeedContent
                            ? 'YES'
                            : 'NO'
                    )
                    : '?';

            const phaseRows =
                (state.progress?.order || [])
                    .map(label => {
                        const phase =
                            state.progress
                                ?.phases
                                ?.[label] ||
                            {};

                        const stateText =
                            phase.status === 'done'
                                ? '✓ DONE'
                                : phase.status === 'running'
                                    ? (
                                        phase.total > 0
                                            ? `● ${phase.current}/${phase.total}`
                                            : '● RUNNING'
                                    )
                                    : phase.status === 'error'
                                        ? '! ERROR'
                                        : '· PENDING';

                        return `
                            <div class="diag-row">
                                <span>${label}</span>
                                <b class="${phase.status === 'error' ? 'warn' : ''}">${stateText}</b>
                            </div>
                        `;
                    })
                    .join('');

            ui.diagnostics.innerHTML = `
                ${phaseRows}

                <div class="diag-separator"></div>

                <div class="diag-row">
                    <span>Coverage</span>
                    <b class="jkl-state ${coverageClass}">${coverageText}</b>
                </div>

                <div class="diag-row">
                    <span>Instagram counter</span>
                    <b>${expected || '—'}</b>
                </div>

                <div class="diag-row">
                    <span>Global gap</span>
                    <b>${expected ? gap : '—'}</b>
                </div>

                <div class="diag-row">
                    <span>Public extras</span>
                    <b>${state.shadow.extras}</b>
                </div>

                <div class="diag-row">
                    <span>Hidden candidates</span>
                    <b>${state.hidden.candidates}</b>
                </div>

                <div class="diag-row">
                    <span>Hidden recovered</span>
                    <b>${state.hidden.recovered}</b>
                </div>

                <div class="diag-row">
                    <span>Hidden preview/skipped</span>
                    <b>${state.hidden.previewOnly}</b>
                </div>

                <div class="diag-row">
                    <span>Exclusive feed</span>
                    <b>${exclusiveText}</b>
                </div>

                <div class="diag-row">
                    <span>POST files</span>
                    <b>${files.POST}</b>
                </div>

                <div class="diag-row">
                    <span>REEL files</span>
                    <b>${files.REEL}</b>
                </div>

                <div class="diag-row">
                    <span>TAGGED files</span>
                    <b>${files.TAGGED}</b>
                </div>
                <div class="diag-row">
                    <span>TAGGED count hints</span>
                    <b class="${state.taggedCountHintMismatches?.length ? 'warn' : ''}">${state.taggedCountHintMismatches?.length || 0}</b>
                </div>
                <div class="diag-row">
                    <span>TAGGED rejected hints</span>
                    <b class="${state.taggedCountHintFailures?.length ? 'warn' : ''}">${state.taggedCountHintFailures?.length || 0}</b>
                </div>
                <div class="diag-row">
                    <span>TAGGED legacy POST paths</span>
                    <b>${state.taggedHistoricalPostRestored || 0}</b>
                </div>

                <div class="diag-row">
                    <span>HIGHLIGHT files</span>
                    <b>${files.HIGHLIGHT}</b>
                </div>

                <div class="diag-row">
                    <span>STORY files</span>
                    <b>${files.STORY}</b>
                </div>

                <div class="diag-row">
                    <span>AVATAR files</span>
                    <b>${files.AVATAR}</b>
                </div>

                <div class="diag-row">
                    <span>HIDDEN missing files</span>
                    <b>${hiddenMissing}</b>
                </div>

                <div class="diag-row">
                    <span>Download errors</span>
                    <b>${state.failed}</b>
                </div>
            `;
        }
    }

    function canonicalShortcode(value) {
        const token =
            String(value || '')
                .trim();

        if (
            !token ||
            !/^[A-Za-z0-9_-]+$/.test(token)
        ) {
            return '';
        }

        /*
         * Instagram authenticated/private permalinks can append a fixed
         * 28-character access-context suffix to the real media shortcode.
         * The canonical shortcode length is therefore NOT fixed: a 10-char
         * shortcode becomes a 38-char permalink token, an 11-char shortcode
         * becomes 39 chars, etc.
         *
         * Never decode that suffix as part of the numeric media PK.
         */
        if (
            token.length >
            APP.PRIVATE_PERMALINK_SUFFIX_LENGTH
        ) {
            const candidate =
                token.slice(
                    0,
                    -APP.PRIVATE_PERMALINK_SUFFIX_LENGTH
                );

            return (
                candidate &&
                /^[A-Za-z0-9_-]+$/.test(candidate)
            )
                ? candidate
                : '';
        }

        return token;
    }

    function profileLinks() {
        const map =
            new Map();

        for (
            const a
            of document.querySelectorAll(
                'a[href*="/p/"],a[href*="/reel/"],a[href*="/reels/"],a[href*="/tv/"]'
            )
        ) {
            const info =
                mediaPermalinkInfo(
                    a.getAttribute('href') ||
                    a.href
                );

            if (!info) {
                continue;
            }
            // An account-prefixed DOM link for a different user is not
            // evidence of a root belonging to the scanned PROFILE.
            if (info.username &&
                info.username.toLowerCase() !==
                    String(state.username || '').toLowerCase()) {
                continue;
            }

            /*
             * Key DOM observations by numeric media identity, not by the raw
             * permalink token. Public and authenticated/private URLs for the
             * same media therefore reconcile to the same root.
             */
            map.set(
                info.mediaId,
                info
            );
        }

        return map;
    }

    function shortcodeId(code) {
        const alpha =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

        const normalized =
            canonicalShortcode(code);

        if (!normalized) {
            return '';
        }

        let v = 0n;

        for (
            const ch
            of normalized
        ) {
            const i =
                alpha.indexOf(ch);

            if (i < 0) {
                return '';
            }

            v =
                v *
                64n +
                BigInt(i);
        }

        /*
         * Instagram media PKs are 64-bit identifiers. Rejecting values above
         * the unsigned 64-bit range prevents an access-context suffix or an
         * unrelated DOM token from ever reaching /media/<id>/info/.
         */
        const maxMediaId =
            (1n << 64n) - 1n;

        return (
            v > 0n &&
            v <= maxMediaId
        )
            ? v.toString()
            : '';
    }

    function mediaPermalinkInfo(value) {
        try {
            const u =
                new URL(
                    String(value || ''),
                    location.origin
                );

            // Instagram exposes both /reel/<shortcode>/ and
            // /<username>/reel/<shortcode>/; the latter previously
            // produced null (including for the age-gated user example).
            // Match complete paths only; do not treat arbitrary nested
            // routes or profile tabs as single-media links.
            const m =
                u.pathname.match(
                    /^\/(?:([A-Za-z0-9._]{1,30})\/)?(p|reels?|tv)\/([A-Za-z0-9_-]+)\/?$/
                );

            if (!m) {
                return null;
            }

            const rawToken =
                String(m[3] || '');

            const shortcode =
                canonicalShortcode(
                    rawToken
                );

            const mediaId =
                shortcodeId(
                    shortcode
                );

            if (
                !shortcode ||
                !mediaId
            ) {
                return null;
            }

            return {
                route: m[2] === 'reels' ? 'reel' : m[2],
                username: m[1] ? cleanUser(m[1]) : '',
                rawToken,
                shortcode,
                mediaId,
                extended:
                    rawToken !==
                    shortcode,
            };
        }
        catch {
            return null;
        }
    }

    function findAnchor(path) {
        const want =
            pathNorm(path);

        for (
            const a
            of document.querySelectorAll(
                'a[href]'
            )
        ) {
            try {
                if (
                    pathNorm(
                        new URL(
                            a.getAttribute('href') ||
                            a.href,
                            location.origin
                        )
                            .pathname
                    ) ===
                    want
                ) {
                    return a;
                }
            }

            catch {}
        }

        return null;
    }

    async function waitPath(
        path,
        ms = 8000
    ) {
        const wanted =
            pathNorm(path);

        const start =
            Date.now();

        while (
            Date.now() -
            start <
            ms
        ) {
            if (
                pathNorm(
                    location.pathname
                ) ===
                wanted
            ) {
                return true;
            }

            await sleep(100);
        }

        return false;
    }

    async function go(path) {
        if (
            pathNorm(
                location.pathname
            ) ===
            pathNorm(path)
        ) {
            return {
                ok: true,
                navigated: false,
            };
        }

        const a =
            findAnchor(path);

        if (!a) {
            return {
                ok: false,
                navigated: false,
            };
        }

        a.click();

        const ok =
            await waitPath(path);

        return {
            ok,
            navigated: ok,
        };
    }

    async function restore(
        path,
        y,
        navigated
    ) {
        if (
            state.feedbackRequired ||
            state.rateLimited ||
            state.apiUnhealthy
        ) {
            return;
        }

        if (navigated) {
            history.back();

            await waitPath(
                path,
                6000
            );
        }

        window.scrollTo({
            top: y,
            behavior: 'auto',
        });
    }

    // An observed /p/ permalink by itself is NOT server-side identity
    // evidence. Only a same-account, same-ID, same-shortcode media-info
    // response with a fully resolved set of child units may fill a gap
    // between two exhausted PROFILE timelines and the official counter.
    function verifiedTargetScopedProfileDomMediaInfo(info, item, userId) {
        const id = String(info?.mediaId || '');
        const code = String(info?.shortcode || '');
        const ownerId = normalizePk(item?.user || item?.owner || {});
        if (info?.route !== 'p' || !/^\d+$/.test(id) ||
            !/^\d+$/.test(String(userId || '')) ||
            ownerId !== String(userId) ||
            normalizePk(item) !== id ||
            !code || canonicalShortcode(item?.code || item?.shortcode || '') !== code ||
            shortcodeId(code) !== id ||
            rootKind(item) !== 'POST') return false;
        try {
            // Reuse the same all-or-nothing strict carousel validation
            // as SOLO: no missing media, duplicated children, or preview
            // in place of an actual file URL.
            const units = standaloneUnits(item, '', id);
            return units.length > 0 &&
                units.every(unit => /^\d+$/.test(String(unit.id || '')) &&
                    !!unit.url && unit.type === 'POST');
        }
        catch {
            return false;
        }
    }

    // Diagnostics only: the strict verifier still decides whether the
    // root can enter OWNED. Never log media URLs or response payloads.
    function profileDomMediaInfoFailureCode(info,item,userId) {
        const id=String(info?.mediaId || '');
        if (info?.route !== 'p') return 'non_post_route';
        if (!/^\d+$/.test(id)) return 'invalid_requested_root';
        if (!/^\d+$/.test(String(userId || ''))) return 'missing_target_account';
        const ownerId=normalizePk(item?.user || item?.owner || {});
        if (!ownerId) return 'returned_owner_missing';
        if (ownerId !== String(userId)) return 'returned_owner_mismatch';
        if (normalizePk(item) !== id) return 'returned_root_mismatch';
        const code=String(info?.shortcode || '');
        if (!code || shortcodeId(code) !== id) return 'requested_shortcode_mismatch';
        if (canonicalShortcode(item?.code || item?.shortcode || '') !== code)
            return 'returned_shortcode_mismatch';
        if (rootKind(item) !== 'POST') return 'not_post_type';
        try {
            const units=standaloneUnits(item,'',id);
            return units.length && units.every(unit =>
                /^\d+$/.test(String(unit.id || '')) &&
                !!unit.url && unit.type==='POST')
                ? 'strict_catalog_not_verified'
                : 'incomplete_media_units';
        } catch {
            return 'incomplete_media_units';
        }
    }

    async function hydratePermalinkRoots(
        list,
        sourceHint =
            'PROFILE_GRID_DOM'
    ) {
        let next = 0;
        let completed = 0;
        let resolved = 0;
        let failed = 0;

        const workerCount = Math.min(
            APP.HYDRATE_WORKERS,
            Math.max(1, list.length)
        );

        const worker = async workerId => {
            if (workerId > 0) {
                await sleep(workerId * 100);
            }

            while (true) {
                if (state.cancelled) {
                    throw new Error('Cancelled');
                }

                const index = next++;

                if (index >= list.length) {
                    return;
                }

                const info = list[index];

                const id =
                    String(
                        info?.mediaId ||
                        shortcodeId(
                            info?.shortcode
                        ) ||
                        ''
                    );

                if (!id) {
                    failed++;

                    log(
                        `${sourceHint} hydrate failed for ` +
                        `${info.shortcode}: invalid shortcode`,
                        'warn'
                    );
                }
                else {
                    try {
                        const item = await fetchOwnedMediaInfo(
                            id,
                            `${sourceHint} ${index + 1}/${list.length}`
                        );

                        const strictDom = sourceHint === 'PROFILE_GRID_DOM' &&
                            info.route === 'p';
                        const domApiProven = strictDom &&
                            verifiedTargetScopedProfileDomMediaInfo(
                                info, item, state.userId
                            );
                        // Do not admit cross-account or incorrectly decoded
                        // visible links into the OWNED scan. Media-info must
                        // corroborate the exact profile and parent shortcode.
                        if (strictDom && !domApiProven) {
                            throw new Error(
                                'PROFILE DOM permalink not confirmed by same-owner, same-ID complete media-info (' +
                                profileDomMediaInfoFailureCode(info,item,state.userId) + ')'
                            );
                        }

                        const forced =
                            info.route === 'reel'
                                ? 'REEL'
                                : '';

                        addMedia(
                            item,
                            forced,
                            sourceHint
                        );

                        if (domApiProven) {
                            const rec = state.rootCatalog.get(id);
                            if (rec?.type === 'POST' &&
                                rec.structureComplete === true &&
                                rec.forceHydrate !== true &&
                                Number.isSafeInteger(rec.expectedUnits) &&
                                rec.expectedUnits > 0 &&
                                queuedUnitsForRoot(id) === rec.expectedUnits &&
                                state.roots.POST.has(id)) {
                                state.verifiedProfileDomApiRootIds.add(id);
                            }
                        }

                        resolved++;
                    }
                    catch (e) {
                        if (
                            e?.code === 'IG_FEEDBACK_REQUIRED' ||
                            state.feedbackRequired
                        ) {
                            throw feedbackCircuitBreak(
                                `${sourceHint} ${index + 1}/${list.length}: ` +
                                `Instagram returned feedback_required.`
                            );
                        }

                        if (
                            e?.code === 'IG_RATE_LIMITED' ||
                            state.rateLimited ||
                            Number(e?.status || 0) === 429
                        ) {
                            throw rateLimitCircuitBreak(
                                `${sourceHint} ${index + 1}/${list.length}: Instagram returned HTTP 429.`
                            );
                        }

                        if (e?.code === 'IG_API_UNHEALTHY') {
                            throw e;
                        }

                        failed++;

                        log(
                            `${sourceHint} hydrate failed for ` +
                            `${info.shortcode}: ${e.message}`,
                            'warn'
                        );
                    }
                }

                completed++;

                if (
                    completed % 8 === 0 ||
                    completed === list.length
                ) {
                    updateStats();
                }

                if (next < list.length) {
                    await sleep(
                        rand(120, 240)
                    );
                }
            }
        };

        if (list.length) {
            await Promise.all(
                Array.from(
                    { length: workerCount },
                    (_, workerId) => worker(workerId)
                )
            );
        }

        return {
            attempted: list.length,
            resolved,
            failed,
        };
    }

    function walkObject(root, visitor) {
        const stack = [{ value: root, path: '' }];
        const seen = new WeakSet();

        while (stack.length) {
            const { value, path } = stack.pop();

            if (!value || typeof value !== 'object') {
                continue;
            }

            if (seen.has(value)) {
                continue;
            }

            seen.add(value);
            visitor(value, path);

            if (Array.isArray(value)) {
                for (let i = value.length - 1; i >= 0; i--) {
                    stack.push({
                        value: value[i],
                        path: `${path}[${i}]`,
                    });
                }
            }
            else {
                for (const [k, v] of Object.entries(value)) {
                    stack.push({
                        value: v,
                        path: path ? `${path}.${k}` : k,
                    });
                }
            }
        }
    }

    function visibleDocumentText(html) {
        const doc = new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );

        for (const el of doc.querySelectorAll(
            'script,style,noscript,template,svg'
        )) {
            el.remove();
        }

        return String(
            doc.body?.textContent ||
            doc.documentElement?.textContent ||
            ''
        )
            .replace(/\s+/g, ' ')
            .trim();
    }

    function anonymousProfileRestriction(html) {
        const text = visibleDocumentText(html);

        if (!text) {
            return null;
        }

        const restrictedHeading =
            /\brestricted profile\b/i.test(text) ||
            /\bprofil restreint\b/i.test(text);

        if (!restrictedHeading) {
            return null;
        }

        const audienceGate =
            /unavailable for certain audiences/i.test(text) ||
            /log in to continue/i.test(text) ||
            /you must be \d{1,2} years? old or over to see this profile/i.test(text) ||
            /you must be \d{1,2} or older to see this profile/i.test(text) ||
            /indisponible pour certains publics/i.test(text) ||
            /connectez-vous pour continuer/i.test(text) ||
            /vous devez avoir \d{1,2} ans(?: ou plus)? pour (?:voir|consulter) ce profil/i.test(text);

        if (!audienceGate) {
            return null;
        }

        return {
            code: 'LOGIN_RESTRICTED_PROFILE',
            text,
        };
    }

    async function fetchAnonymousProfileProbe(
        username,
        label,
        forceEnglish = false
    ) {
        const suffix = forceEnglish ? '?hl=en' : '';
        const headers = {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': navigator.userAgent,
        };

        if (forceEnglish) {
            headers['Accept-Language'] = 'en-US,en;q=0.9';
        }

        return gmRequest({
            method: 'GET',
            url: `https://www.instagram.com/${username}/${suffix}`,
            anonymous: true,
            feedbackLabel: label,
            headers,
        });
    }

    function shadowCoverageLabel() {
        if (state.shadow.applicable) {
            return String(state.coverage.publicShadow);
        }

        if (state.shadow.reason === 'PRIVATE_PROFILE') {
            return 'N/A(PRIVATE)';
        }

        if (state.shadow.reason === 'LOGIN_RESTRICTED_PROFILE') {
            return 'N/A(RESTRICTED)';
        }

        if (state.shadow.reason === 'ANONYMOUS_TARGET_UNAVAILABLE') {
            return 'N/A(ANON_UNAVAILABLE)';
        }

        return `N/A(${state.shadow.reason || 'NOT_APPLICABLE'})`;
    }

    // Read ONLY observed Instagram SSR profile metadata. An omitted field
    // is unknown, never false/zero. Multiple SSR copies must agree before
    // their values can authorize proof of an empty REELS surface.
    function publicSSRReelsEvidence(candidates) {
        const profileId = String(state.userId || '');
        const username = String(state.username || '').toLowerCase();
        const raws = (Array.isArray(candidates) ? candidates : [])
            .map(x => x?.user)
            .filter(u =>
                String(u?.pk || '') === profileId &&
                (
                    !u?.username ||
                    String(u.username).toLowerCase() === username
                )
            );

        if (!profileId || !raws.length) return null;

        const counts = [];
        const flags = [];
        let latestStoryTimestampPresent = false;
        let invalidMetadata = false;

        for (const user of raws) {
            if (typeof user.has_any_clips === 'boolean') {
                flags.push(user.has_any_clips);
            }
            else if (user.has_any_clips !== undefined &&
                user.has_any_clips !== null) {
                invalidMetadata = true;
            }

            const raw = user.total_clips_count;
            if (
                typeof raw === 'number' && Number.isSafeInteger(raw) &&
                raw >= 0
            ) counts.push(raw);
            else if (typeof raw === 'string' && /^\d+$/.test(raw) &&
                Number.isSafeInteger(Number(raw))) {
                counts.push(Number(raw));
            }
            else if (raw !== undefined && raw !== null) {
                invalidMetadata = true;
            }

            if (
                user.latest_reel_media !== null &&
                user.latest_reel_media !== undefined &&
                user.latest_reel_media !== 0 &&
                user.latest_reel_media !== '0' &&
                user.latest_reel_media !== false &&
                user.latest_reel_media !== ''
            ) latestStoryTimestampPresent = true;
        }

        const hasAnyClips = flags.length ? flags[0] : null;
        const totalClipsCount = counts.length ? counts[0] : null;
        const consistent =
            !invalidMetadata &&
            flags.every(v => v === hasAnyClips) &&
            counts.every(v => v === totalClipsCount) &&
            !(hasAnyClips === false && totalClipsCount > 0) &&
            !(hasAnyClips === true && totalClipsCount === 0);

        return Object.freeze({
            profileId, username,
            hasAnyClips, totalClipsCount,
            latestStoryTimestampPresent, consistent,
            source: 'xig_user_by_username/public-profile-SSR',
        });
    }

    function parseAnonymousProfileHTML(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const candidates = [];

        for (const script of doc.querySelectorAll('script[type="application/json"]')) {
            const text = script.textContent || '';

            if (!text.includes('polaris_ordered_timeline_connection')) {
                continue;
            }

            let parsed;

            try {
                parsed = JSON.parse(text);
            }
            catch {
                continue;
            }

            walkObject(parsed, obj => {
                const user = obj?.xig_user_by_username;
                const conn = user?.polaris_ordered_timeline_connection;

                if (
                    user &&
                    conn &&
                    String(user.pk || '') === state.userId &&
                    Array.isArray(conn.edges)
                ) {
                    candidates.push({ user, conn });
                }
            });
        }

        if (!candidates.length) {
            throw new Error('SSR public timeline not found');
        }

        candidates.sort(
            (a, b) => (b.conn.edges?.length || 0) - (a.conn.edges?.length || 0)
        );

        const best = candidates[0];
        let relayId = null;

        for (const edge of best.conn.edges || []) {
            relayId = edge?.node?.user?.id || relayId;

            if (relayId) {
                break;
            }
        }

        if (!relayId) {
            const escapedId = state.userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const m = html.match(
                new RegExp(`"pk":"${escapedId}"[^]{0,600}?"id":"(\\d+)"`)
            );

            relayId = m?.[1] || null;
        }

        const lsd =
            html.match(/\["LSD",\[\],\{"token":"([^"]+)"\}/)?.[1] ||
            html.match(/"LSD"[^]{0,300}?"token":"([^"]+)"/)?.[1] ||
            null;

        return {
            edges: best.conn.edges || [],
            pageInfo: best.conn.page_info || null,
            relayId,
            lsd,
            reelsEvidence: publicSSRReelsEvidence(candidates),
        };
    }

    function publicEdgeRoot(edge) {
        const n = edge?.node;

        if (!n) {
            return null;
        }

        const pk = String(n.pk || n.id || '')
            .replace(/^POLARIS_/, '')
            .split('_')[0];

        const code = String(n.code || n.shortcode || '');

        if (!pk || !code) {
            return null;
        }

        return {
            pk,
            code,
            media_type: n.media_type ?? null,
            product_type: String(n.product_type || n.media_product_type || ''),
            taken_at: Number(n.taken_at || n.taken_at_timestamp || 0),
            cursor: edge?.cursor || null,
        };
    }

    function jazoestFromLsd(lsd) {
        return '2' + [...lsd].reduce(
            (sum, c) => sum + c.charCodeAt(0),
            0
        );
    }

    async function fetchAnonymousGridPage(relayId, after, lsd) {
        if (!relayId || !after || !lsd) {
            throw new Error('relayId/after/LSD missing');
        }

        const variables = {
            after,
            first: 12,
            id: relayId,
        };

        const body = new URLSearchParams({
            av: '0',
            __d: 'www',
            __user: '0',
            __a: '1',
            __req: '1',
            __comet_req: '7',
            lsd,
            jazoest: jazoestFromLsd(lsd),
            fb_api_caller_class: 'RelayModern',
            fb_api_req_friendly_name: APP.PUBLIC_GRID_NAME,
            variables: JSON.stringify(variables),
            server_timestamps: 'true',
            doc_id: APP.PUBLIC_GRID_DOC,
        });

        const r = await gmRequest({
            method: 'POST',
            url: 'https://www.instagram.com/api/graphql',
            anonymous: true,
            feedbackLabel: 'PUBLIC shadow pagination',
            headers: {
                Accept: '*/*',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-FB-LSD': lsd,
                'X-FB-Friendly-Name': APP.PUBLIC_GRID_NAME,
                'X-IG-App-ID': APP.APP_ID,
                Referer: `https://www.instagram.com/${state.username}/`,
            },
            data: body.toString(),
        });

        if (feedbackRequiredIn(r.responseText)) {
            throw feedbackCircuitBreak(
                'PUBLIC shadow pagination: Instagram returned feedback_required.'
            );
        }

        let d;

        try {
            d = JSON.parse(r.responseText);
        }
        catch {
            if (Number(r.status || 0) === 200) {
                throw apiUnhealthyError(
                    'PUBLIC shadow pagination: Instagram returned HTTP 200 non-JSON; scan stopped.'
                );
            }

            throw new Error(`non JSON response (HTTP ${r.status})`);
        }

        if (d?.errors?.length) {
            const message =
                d.errors.map(x => x?.message || 'GraphQL error').join(' | ');

            if (feedbackRequiredIn(message)) {
                throw feedbackCircuitBreak(
                    'PUBLIC shadow pagination: Instagram returned feedback_required.'
                );
            }

            throw new Error(message);
        }

        const conn = d?.data?.node?.polaris_ordered_timeline_connection;

        if (!conn || !Array.isArray(conn.edges)) {
            throw new Error('public timeline connection missing');
        }

        return conn;
    }

    async function hydratePublicRoot(root, index, total) {
        const item = await fetchOwnedMediaInfo(
            root.pk,
            `PUBLIC SHADOW ${index}/${total}`
        );

        addMedia(
            item,
            'POST',
            'PROFILE_PUBLIC_SHADOW'
        );
    }

    async function scanPublicShadow() {
        state.coverage.publicShadow = false;
        state.shadow.applicable = true;
        state.shadow.reason = '';
        state.shadow.totalRoots = 0;
        state.shadow.postRoots = 0;
        state.shadow.extras = 0;
        state.shadow.pages = 0;
        state.shadow.profileId = '';
        state.shadow.pageInfoEnded = false;
        state.shadow.rootIds = new Set();
        state.shadow.postIds = new Set();
        state.shadow.reelIds = new Set();
        state.shadow.reelsEvidence = null;

        if (state.profileInfo?.is_private === true) {
            state.shadow.applicable = false;
            state.shadow.reason = 'PRIVATE_PROFILE';
            state.coverage.publicShadow = true;

            log(
                `PUBLIC shadow N/A: @${state.username} is private; ` +
                `anonymous timeline is unavailable by design. ` +
                `Connected PROFILE/REELS/HIDDEN/HYDRATION coverage remains mandatory.`
            );

            status('PUBLIC shadow N/A for private profile.', 'ok');
            updateStats();
            return true;
        }

        log('Scanning anonymous PUBLIC shadow grid…');
        status('Scanning PUBLIC shadow…');

        try {
            const r = await fetchAnonymousProfileProbe(
                state.username,
                'PUBLIC shadow profile'
            );

            if (feedbackRequiredIn(r.responseText)) {
                throw feedbackCircuitBreak(
                    'PUBLIC shadow profile: Instagram returned feedback_required.'
                );
            }

            if (Number(r.status) !== 200) {
                throw new Error(`profile HTTP ${r.status}`);
            }

            let targetHtml = String(r.responseText || '');
            const restriction =
                anonymousProfileRestriction(targetHtml);

            if (restriction?.code === 'LOGIN_RESTRICTED_PROFILE') {
                state.shadow.applicable = false;
                state.shadow.reason = 'LOGIN_RESTRICTED_PROFILE';
                state.coverage.publicShadow = true;

                log(
                    `PUBLIC shadow N/A: @${state.username} is explicitly ` +
                    `restricted by Instagram for anonymous audiences; ` +
                    `the page requires a logged-in viewer. ` +
                    `Connected PROFILE/REELS/HIDDEN/HYDRATION coverage remains mandatory.`
                );

                status(
                    'PUBLIC shadow N/A for login-restricted profile.',
                    'ok'
                );

                updateStats();
                return true;
            }

            let initial;

            try {
                initial = parseAnonymousProfileHTML(targetHtml);
            }
            catch (e) {
                if (e?.message !== 'SSR public timeline not found') {
                    throw e;
                }

                log(
                    'PUBLIC shadow SSR missing on first anonymous probe; ' +
                    'verifying target-specific anonymous availability…',
                    'warn'
                );

                // Re-check only the requested account. Probing unrelated
                // public accounts cannot prove this profile is inaccessible,
                // and adds unsolicited network requests to every failure.
                const retry = await fetchAnonymousProfileProbe(
                    state.username,
                    'PUBLIC shadow profile verification',
                    true
                );

                if (Number(retry.status || 0) !== 200) {
                    throw new Error(
                        `PUBLIC shadow verification HTTP ${retry.status}`
                    );
                }

                targetHtml = String(retry.responseText || '');
                const retryRestriction =
                    anonymousProfileRestriction(targetHtml);

                if (retryRestriction?.code === 'LOGIN_RESTRICTED_PROFILE') {
                    state.shadow.applicable = false;
                    state.shadow.reason = 'LOGIN_RESTRICTED_PROFILE';
                    state.coverage.publicShadow = true;
                    log(
                        'PUBLIC shadow N/A: explicit target-scoped Instagram ' +
                        'restricted-profile gate on verification.'
                    );
                    updateStats();
                    return true;
                }

                try {
                    initial = parseAnonymousProfileHTML(targetHtml);
                    log(
                        'PUBLIC shadow verification recovered the anonymous SSR timeline.'
                    );
                }
                catch (retryError) {
                    if (
                        retryError?.message !== 'SSR public timeline not found'
                    ) {
                        throw retryError;
                    }

                    // NO third-party control profiles. Missing SSR remains
                    // unknown; it must never become a false N/A success.
                    log(
                        'PUBLIC shadow SSR unavailable after two target-only ' +
                        'requests; no control-profile probing performed. ' +
                        'PUBLIC shadow remains INCOMPLETE.',
                        'warn'
                    );
                    throw new Error(
                        'SSR public timeline unavailable after two target-only requests'
                    );
                }
            }

            const roots = new Map();

            for (const edge of initial.edges) {
                const root = publicEdgeRoot(edge);

                if (root) {
                    roots.set(root.pk, root);
                }
            }

            state.shadow.pages = 1;

            log(
                `PUBLIC shadow page 1: ${initial.edges.length} roots, ` +
                `has_next_page=${Boolean(initial.pageInfo?.has_next_page)}.`
            );

            let pageInfo = initial.pageInfo;
            let ended = pageInfo?.has_next_page === false;
            const seenCursors = new Set();

            while (
                pageInfo?.has_next_page &&
                pageInfo?.end_cursor &&
                state.shadow.pages < APP.SHADOW_MAX_PAGES
            ) {
                if (seenCursors.has(pageInfo.end_cursor)) {
                    ended = false;

                    log(
                        `PUBLIC shadow cursor repeated at page ${state.shadow.pages}; ` +
                        `stopping as INCOMPLETE instead of looping.`,
                        'warn'
                    );

                    break;
                }

                seenCursors.add(pageInfo.end_cursor);

                const conn = await fetchAnonymousGridPage(
                    initial.relayId,
                    pageInfo.end_cursor,
                    initial.lsd
                );

                state.shadow.pages++;

                for (const edge of conn.edges || []) {
                    const root = publicEdgeRoot(edge);

                    if (root) {
                        roots.set(root.pk, root);
                    }
                }

                pageInfo = conn.page_info || null;
                ended = pageInfo?.has_next_page === false;

                log(
                    `PUBLIC shadow page ${state.shadow.pages}: ` +
                    `${conn.edges?.length || 0} roots, ` +
                    `has_next_page=${Boolean(pageInfo?.has_next_page)}.`
                );

                if (pageInfo?.has_next_page) {
                    await sleep(
                        rand(
                            APP.SHADOW_PAGE_MIN,
                            APP.SHADOW_PAGE_MAX
                        )
                    );
                }
            }

            if (
                pageInfo?.has_next_page === true &&
                !pageInfo?.end_cursor
            ) {
                ended = false;
            }

            if (
                pageInfo?.has_next_page === true &&
                state.shadow.pages >= APP.SHADOW_MAX_PAGES
            ) {
                ended = false;

                log(
                    `PUBLIC shadow safety cap reached (${APP.SHADOW_MAX_PAGES} pages) ` +
                    `while Instagram still advertises more pages; scan remains INCOMPLETE.`,
                    'warn'
                );
            }

            const allRoots = [...roots.values()];
            const publicPosts = allRoots.filter(root => {
                const p = String(root.product_type || '').toLowerCase();
                return p !== 'clips' && p !== 'reels';
            });
            const publicReels = allRoots.filter(root => {
                const p = String(root.product_type || '').toLowerCase();
                return p === 'clips' || p === 'reels';
            });

            const before = ownedIds();
            const extras = publicPosts.filter(root => !before.has(root.pk));

            state.shadow.totalRoots = allRoots.length;
            state.shadow.postRoots = publicPosts.length;
            state.shadow.extras = extras.length;

            setScanProgressPhase(
                'PUBLIC SHADOW',
                0,
                extras.length,
                extras.length
                    ? 'hydrating extras'
                    : 'no extras'
            );

            let hydrated = 0;

            for (let i = 0; i < extras.length; i++) {
                if (state.cancelled) {
                    throw new Error('Cancelled');
                }

                try {
                    await hydratePublicRoot(extras[i], i + 1, extras.length);
                    hydrated++;
                }
                catch (e) {
                    ended = false;

                    if (
                        e?.code === 'IG_FEEDBACK_REQUIRED' ||
                        state.feedbackRequired
                    ) {
                        throw feedbackCircuitBreak(
                            `Instagram returned feedback_required during PUBLIC shadow ` +
                            `at ${i + 1}/${extras.length}. Remaining extras were not queried.`
                        );
                    }

                    if (
                        e?.code === 'IG_RATE_LIMITED' ||
                        state.rateLimited ||
                        Number(e?.status || 0) === 429
                    ) {
                        throw rateLimitCircuitBreak(
                            `Instagram rate limit during PUBLIC shadow ` +
                            `at ${i + 1}/${extras.length}. Remaining extras were not queried.`
                        );
                    }

                    if (e?.code === 'IG_API_UNHEALTHY') {
                        throw e;
                    }

                    log(
                        `PUBLIC shadow hydrate failed for ${extras[i].code}: ${e.message}`,
                        'warn'
                    );
                }

                setScanProgressPhase(
                    'PUBLIC SHADOW',
                    i + 1,
                    extras.length,
                    'hydrating extras'
                );

                if ((i + 1) % 4 === 0) {
                    updateStats();
                }

                await sleep(350);
            }

            state.coverage.publicShadow = ended && hydrated === extras.length;

            // Preserve the identity-scoped set of ALL public grid
            // roots, including clips that are not hydrated by the
            // POST-only public shadow pass. It is only eligible as
            // proof if the pagination explicitly ended.
            if (state.coverage.publicShadow) {
                state.shadow.profileId = String(state.userId || '');
                state.shadow.pageInfoEnded = pageInfo?.has_next_page === false;
                state.shadow.rootIds = new Set(roots.keys());
                state.shadow.postIds = new Set(publicPosts.map(r => r.pk));
                state.shadow.reelIds = new Set(publicReels.map(r => r.pk));
                state.shadow.reelsEvidence = initial.reelsEvidence?.profileId ===
                    String(state.userId || '')
                    ? initial.reelsEvidence
                    : null;
            }

            const ssr = state.shadow.reelsEvidence;
            log(
                'PUBLIC shadow REELS metadata: ' +
                'has_any_clips=' + (ssr?.hasAnyClips ?? '-') +
                ', total_clips_count=' + (ssr?.totalClipsCount ?? '-') +
                ', story_timestamp_present=' + (ssr?.latestStoryTimestampPresent ?? '-') +
                ', consistent=' + (ssr?.consistent ?? '-') +
                ', source=' + (ssr?.source || '-')
            );

            updateStats();

            log(
                `PUBLIC shadow complete: total=${allRoots.length}, ` +
                `POST=${publicPosts.length}, extras=${extras.length}, ` +
                `hydrated=${hydrated}, ended=${state.coverage.publicShadow}.`
            );

            return state.coverage.publicShadow;
        }
        catch (e) {
            state.coverage.publicShadow = false;
            throwIfInstagramStop(e, 'PUBLIC shadow');

            log(
                `PUBLIC shadow unavailable: ${e.message}`,
                'warn'
            );

            updateStats();
            return false;
        }
    }

    function hiddenCandidateArray(d) {
        if (Array.isArray(d?.items)) {
            return d.items;
        }

        if (Array.isArray(d?.profile_grid_items)) {
            return d.profile_grid_items;
        }

        return [];
    }

    function hiddenNextCursor(d) {
        return String(
            d?.next_max_id ||
            d?.profile_grid_items_cursor ||
            d?.paging_info?.max_id ||
            ''
        );
    }

    function hiddenAccessDeniedError(e) {
        const status = Number(e?.status || 0);
        const msg = String(e?.message || '').toLowerCase();

        if ([400, 401, 403, 404].includes(status)) {
            return true;
        }

        return /not found|unavailable|not authorized|not authorised|permission|login_required|login required|media unavailable/.test(msg);
    }

    async function fetchConnectedHiddenPage(maxId = '') {
        const qs = new URLSearchParams({
            target_user_id: state.userId,
        });

        if (maxId) {
            qs.set('max_id', maxId);
        }

        const r = await gmRequest({
            method: 'GET',
            url:
                'https://www.instagram.com/api/v1/fan_club/' +
                'user_exclusive_feed_timeline/?' +
                qs.toString(),
            feedbackLabel: 'CONNECTED hidden',
            headers: {
                Accept: '*/*',
                'User-Agent': APP.MOBILE_UA,
                'X-IG-App-ID': APP.APP_ID,
                'X-ASBD-ID': APP.ASBD_ID,
                'X-Requested-With': 'XMLHttpRequest',
                Referer: `https://www.instagram.com/${state.username}/`,
            },
        });

        if (feedbackRequiredIn(r.responseText)) {
            throw feedbackCircuitBreak(
                'CONNECTED hidden: Instagram returned feedback_required.'
            );
        }

        let d = null;

        try {
            d = JSON.parse(r.responseText);
        }
        catch {
            if (Number(r.status || 0) === 200) {
                throw apiUnhealthyError(
                    'CONNECTED hidden: Instagram returned HTTP 200 non-JSON; scan stopped.'
                );
            }

            const e = new Error(`CONNECTED hidden HTTP ${r.status} non JSON`);
            e.status = Number(r.status || 0);
            throw e;
        }

        if (Number(r.status) !== 200 || d?.status !== 'ok') {
            const e = new Error(
                d?.message ||
                d?.status ||
                `CONNECTED hidden HTTP ${r.status}`
            );
            e.status = Number(r.status || 0);
            throw e;
        }

        return d;
    }

    async function scanConnectedHiddenCandidates() {
        state.coverage.connectedHidden = false;
        state.hidden.pages = 0;
        state.hidden.candidates = 0;
        state.hidden.alreadyOwned = 0;
        state.hidden.recovered = 0;
        state.hidden.previewOnly = 0;
        state.hidden.failed = 0;
        state.hidden.recoveredCodes = [];

        if (!state.userId) {
            log('CONNECTED hidden sweep skipped: no user ID.', 'warn');
            updateStats();
            return false;
        }

        /*
         * Instagram exposes a small set of subscription-preview cards through
         * this endpoint. Despite the endpoint name, observed cards can be
         * ordinary posts hidden from one or more profile-grid surfaces (for
         * example public-shadow differences or age-gated posts). We therefore
         * use it only as a CANDIDATE DISCOVERY surface.
         *
         * We never treat a preview card itself as proof of full access. A new
         * candidate must be resolvable through the current authenticated
         * session's /media/<pk>/info/ endpoint before it becomes an OWNED root.
         */

        log('Scanning CONNECTED hidden/preview candidates…');
        status('Scanning CONNECTED hidden candidates…');

        const candidates = new Map();
        const seenCursors = new Set();
        let cursor = '';
        let ended = false;

        try {
            for (let page = 1; page <= 20; page++) {
                if (state.cancelled) {
                    throw new Error('Cancelled');
                }

                const d = await fetchConnectedHiddenPage(cursor);
                const items = hiddenCandidateArray(d);

                state.hidden.pages = page;

                for (const raw of items) {
                    const item = raw?.media && typeof raw.media === 'object'
                        ? raw.media
                        : raw;
                    const pk = normalizePk(item);

                    if (pk) {
                        candidates.set(String(pk), item);
                    }
                }

                const next = hiddenNextCursor(d);
                const more = d?.more_available === true;

                log(
                    `CONNECTED hidden page ${page}: ` +
                    `items=${items.length}, unique=${candidates.size}, ` +
                    `more_available=${more}, cursor=${next || '<none>'}.`
                );

                if (!more) {
                    ended = true;
                    break;
                }

                if (!next) {
                    ended = false;
                    log(
                        'CONNECTED hidden source says more_available=true but no cursor was returned.',
                        'warn'
                    );
                    break;
                }

                if (seenCursors.has(next)) {
                    ended = false;
                    log('CONNECTED hidden cursor repeated; stopping.', 'warn');
                    break;
                }

                seenCursors.add(next);
                cursor = next;

                await sleep(rand(APP.PAGE_MIN, APP.PAGE_MAX));
            }
        }
        catch (e) {
            throwIfInstagramStop(e, 'CONNECTED hidden: Instagram returned feedback_required.');

            if (e?.message === 'Cancelled') {
                throw e;
            }

            /* A profile without a fan-club surface can legitimately not expose
             * this endpoint. If Instagram itself reports no exclusive feed,
             * absence of this optional candidate source is not a completeness
             * failure. */
            if (
                state.exclusive.known &&
                !state.exclusive.hasExclusiveFeedContent &&
                hiddenAccessDeniedError(e)
            ) {
                ended = true;
                log(
                    `CONNECTED hidden source not applicable for this profile: ${e.message}.`
                );
            }
            else {
                state.hidden.failed++;
                state.coverage.connectedHidden = false;
                log(`CONNECTED hidden source failed: ${e.message}`, 'warn');
                updateStats();
                return false;
            }
        }

        state.hidden.candidates = candidates.size;

        setScanProgressPhase(
            'CONNECTED HIDDEN',
            0,
            candidates.size,
            candidates.size
                ? 'verifying candidates'
                : 'no candidates'
        );

        const before = ownedIds();
        let transientFailures = 0;
        let candidateIndex = 0;

        for (const [pk, preview] of candidates.entries()) {
            candidateIndex++;

            setScanProgressPhase(
                'CONNECTED HIDDEN',
                candidateIndex,
                candidates.size,
                'verifying candidates'
            );
            if (state.cancelled) {
                throw new Error('Cancelled');
            }

            const code = String(
                preview?.code ||
                preview?.shortcode ||
                ''
            );

            if (before.has(pk) || ownedIds().has(pk)) {
                state.hidden.alreadyOwned++;
                continue;
            }

            try {
                const item = await fetchOwnedMediaInfo(
                    pk,
                    `CONNECTED hidden ${code || pk}`
                );

                const ownerId = String(
                    item?.user?.pk ||
                    item?.user?.id ||
                    item?.owner?.pk ||
                    item?.owner?.id ||
                    ''
                );

                if (ownerId && ownerId !== String(state.userId)) {
                    state.hidden.previewOnly++;
                    log(
                        `CONNECTED hidden candidate ${code || pk} belongs to another owner; skipped.`,
                        'warn'
                    );
                    continue;
                }

                const type = rootKind(item);

                if (
                    (type === 'POST' && !scanSelected('post')) ||
                    (type === 'REEL' && !scanSelected('reel'))
                ) {
                    state.hidden.previewOnly++;
                    continue;
                }

                addMedia(
                    item,
                    type,
                    'CONNECTED_HIDDEN_AUTHORIZED'
                );

                const nowOwned = ownedIds().has(pk);
                const units = queuedUnitsForRoot(pk);

                if (!nowOwned || units < 1) {
                    throw new Error('authenticated media-info returned no downloadable unit');
                }

                // The candidate passed authenticated media-info, owner
                // matching, media selection and downloadable-unit checks.
                state.verifiedSubscriberRootIds.add(String(pk));
                state.hidden.recovered++;
                state.hidden.recoveredCodes.push(
                    String(
                        item?.code ||
                        item?.shortcode ||
                        code ||
                        pk
                    )
                );

                log(
                    `CONNECTED hidden recovered: ` +
                    `${item?.code || item?.shortcode || code || pk} ` +
                    `(PK=${pk}, type=${type}, ` +
                    `visibility=${item?.subscription_media_visibility || '<none>'}).`
                );
            }
            catch (e) {
                throwIfInstagramStop(
                    e,
                    `CONNECTED hidden ${code || pk}: Instagram returned feedback_required.`
                );

                if (hiddenAccessDeniedError(e)) {
                    state.hidden.previewOnly++;
                    log(
                        `CONNECTED hidden candidate ${code || pk} is preview-only/not authorized by media-info; skipped.`,
                        'warn'
                    );
                }
                else {
                    transientFailures++;
                    state.hidden.failed++;
                    log(
                        `CONNECTED hidden candidate ${code || pk} could not be verified: ${e.message}`,
                        'warn'
                    );
                }
            }

            updateStats();
            await sleep(rand(APP.HYDRATE_MIN, APP.HYDRATE_MAX));
        }

        state.coverage.connectedHidden =
            ended && transientFailures === 0;

        updateStats();

        log(
            `CONNECTED hidden complete: ` +
            `candidates=${state.hidden.candidates}, ` +
            `alreadyOwned=${state.hidden.alreadyOwned}, ` +
            `recovered=${state.hidden.recovered}, ` +
            `previewOnly=${state.hidden.previewOnly}, ` +
            `failed=${state.hidden.failed}, ` +
            `ended=${state.coverage.connectedHidden}` +
            (state.hidden.recoveredCodes.length
                ? `, recoveredCodes=${state.hidden.recoveredCodes.join(',')}`
                : '') +
            '.'
        );

        return state.coverage.connectedHidden;
    }

    // The document-start observer may have already captured a real,
    // identity-scoped native PROFILE response while Instagram loaded.
    // A scan must not erase that evidence before it can be evaluated.
    // The bootstrap is single-use and time-limited; old scan results,
    // different users and stale pagination are never re-authorized.
    function prepareProfileNativeEvidenceForScan(userKey, now = Date.now()) {
        const key = cleanUser(userKey).toLowerCase();
        const observedAt = net.gridCaptureSeenAtByUser.get(key);
        const info = net.gridPageInfo.get(key);
        const audit = net.gridNativeAuditByUser.get(key);
        const age = Number(now) - Number(observedAt);
        const fresh = Number.isFinite(observedAt) &&
            Number.isFinite(age) &&
            age >= 0 &&
            age <= APP.PROFILE_BOOTSTRAP_MAX_AGE_MS;
        const eligible = fresh &&
            !net.gridBootstrapConsumedByUser.has(key) &&
            !!audit &&
            audit.initial > 0 &&
            !!info &&
            typeof info.has_next_page === 'boolean' &&
            net.gridByUser.has(key);

        if (eligible) {
            net.gridBootstrapConsumedByUser.add(key);
            return {
                retained: true, roots: net.gridByUser.get(key).size,
                ageMs: age, pageInfo: info,
            };
        }

        net.gridByUser.set(key, new Map());
        net.gridPageInfo.delete(key);
        net.gridDocByUser.delete(key);
        net.gridQueryByUser.delete(key);
        net.gridNativeAuditByUser.delete(key);
        net.gridNativeContinuationByUser.delete(key);
        net.gridNativeInitialByUser.delete(key);
        net.gridCaptureSeenAtByUser.delete(key);

        return { retained: false, roots: 0, ageMs: null, pageInfo: null };
    }

    // Isolate a genuine current-profile native capture from the previous
    // browser interaction. A stale/consumed snapshot must not survive into
    // another scan, even if its media IDs still happen to match.
    function prepareReelsNativeEvidenceForScan(uid, now = Date.now()) {
        const id = String(uid || '');
        const capturedAt = net.reelCaptureSeenAtByUserId?.get(id);
        const age = Number(now) - Number(capturedAt);
        const audit = net.reelNativeAuditByUserId.get(id);
        const roots = net.reelsByUserId.get(id);
        const eligible =
            Number.isFinite(capturedAt) && Number.isFinite(age) &&
            age >= 0 && age <= APP.PROFILE_BOOTSTRAP_MAX_AGE_MS &&
            audit?.initial >= 1 && roots instanceof Map &&
            roots.size > 0 &&
            net.reelBootstrapConsumedByUserId?.has(id) !== true;

        if (eligible) {
            net.reelBootstrapConsumedByUserId.add(id);
            return {retained:true, roots:roots.size, ageMs:age};
        }

        net.reelsByUserId.set(id, new Map());
        net.reelPageInfo.delete(id);
        net.reelNativeAuditByUserId.delete(id);
        net.reelNativeInitialByUserId.delete(id);
        net.reelNativeContinuationByUserId.delete(id);
        net.reelCaptureSeenAtByUserId?.delete(id);
        return {retained:false, roots:0, ageMs:null};
    }

    // Consume only a fresh, ID-bound first TAGGED page captured by the real
    // browser. A previous profile or scan cannot reuse it as completion proof.
    function prepareTaggedNativeEvidenceForScan(uid, now = Date.now()) {
        const id = String(uid || '');
        const snapshot = net.taggedNativeByUserId.get(id);
        const age = Number(now) - Number(snapshot?.capturedAt);
        const eligible = !!snapshot && snapshot.uid === id &&
            Number.isFinite(age) && age >= 0 &&
            age <= APP.PROFILE_BOOTSTRAP_MAX_AGE_MS &&
            !net.taggedBootstrapConsumedByUserId.has(id) &&
            !!taggedConn(snapshot.data) &&
            typeof taggedConn(snapshot.data)?.page_info?.has_next_page === 'boolean';

        if (!eligible) {
            net.taggedNativeByUserId.delete(id);
            return {retained:false, roots:0, ageMs:null};
        }

        net.taggedBootstrapConsumedByUserId.add(id);
        net.taggedNativeByUserId.delete(id);
        net.taggedInitialData = snapshot.data;
        net.taggedInitialUserId = id;
        net.taggedNativeVariables = snapshot.variables;
        if (snapshot.friendly.endsWith('_connection')) {
            net.taggedDocConnection = snapshot.docId;
        } else {
            net.taggedDocInitial = snapshot.docId;
        }
        return {
            retained:true,
            roots:taggedConn(snapshot.data).edges.length,
            ageMs:age,
        };
    }

    function profileCompletionRequirement({
        primeCaptured = false,
        nativeEnded = false,
        nativeOwned = 0,
        expected = 0,
    } = {}) {
        const reasons = [];

        /*
         * A page_info value arriving after the prime window is not allowed to
         * retroactively turn a missed native capture into a completion proof.
         *
         * Conversely, a fresh, explicitly targeted PROFILE query captured
         * inside the prime window may prove the end directly. This avoids
         * replaying a full canonical PROFILE pagination on large accounts when
         * native pagination already completed cleanly.
         */
        if (!primeCaptured) {
            reasons.push(
                'prime_capture_missed'
            );
        }

        if (!nativeEnded) {
            reasons.push(
                'native_end_unproven'
            );
        }

        /*
         * media_count remains informational only. A native result below that
         * counter does NOT make the scan incomplete by itself; it merely
         * forces an independent canonical completion pass. The fallback's own
         * pagination end remains the actual proof.
         */
        const counter =
            Math.max(
                0,
                Number(expected || 0)
            );

        const owned =
            Math.max(
                0,
                Number(nativeOwned || 0)
            );

        if (
            counter > 0 &&
            owned < counter
        ) {
            reasons.push(
                'native_below_ig_counter'
            );
        }

        return {
            required:
                reasons.length > 0,
            reasons,
        };
    }

    function currentProfileGridProgress() {
        const map =
            net.gridByUser.get(
                state.username.toLowerCase()
            ) ||
            new Map();

        return {
            network: map.size,
            height: Math.max(
                document.body?.scrollHeight || 0,
                document.documentElement?.scrollHeight || 0
            ),
        };
    }

    async function waitForProfileGridProgress(
        baseline
    ) {
        const started = Date.now();

        await sleep(APP.PROFILE_SCROLL_MIN);

        while (
            Date.now() - started <
            APP.PROFILE_SCROLL_MAX
        ) {
            if (state.cancelled) {
                throw new Error('Cancelled');
            }

            const current =
                currentProfileGridProgress();

            if (
                current.network > baseline.network ||
                current.height > baseline.height
            ) {
                return true;
            }

            await sleep(APP.PROFILE_SCROLL_POLL);
        }

        return false;
    }

    async function waitForFreshProfileGridCapture(ms = 3200) {
        const key = state.username.toLowerCase();
        const started = Date.now();

        while (Date.now() - started < ms) {
            if (state.cancelled) {
                throw new Error('Cancelled');
            }

            if (state.feedbackRequired || state.rateLimited || state.apiUnhealthy) {
                const e = new Error('Native PROFILE capture stopped by Instagram circuit breaker.');
                e.code = state.feedbackRequired
                    ? 'IG_FEEDBACK_REQUIRED'
                    : state.rateLimited
                        ? 'IG_RATE_LIMITED'
                        : 'IG_API_UNHEALTHY';
                throw e;
            }

            const map = net.gridByUser.get(key) || new Map();
            if (map.size > 0 || net.gridPageInfo.has(key)) {
                return {
                    captured: true,
                    roots: map.size,
                    pageInfo: net.gridPageInfo.get(key) || null,
                };
            }

            await sleep(100);
        }

        return { captured: false, roots: 0, pageInfo: null };
    }

    async function primeProfileGridNativeCapture(target, navigationTriggered = false) {
        const key = state.username.toLowerCase();
        const existing = net.gridByUser.get(key) || new Map();

        if (existing.size > 0 || net.gridPageInfo.has(key)) {
            return {
                attempted: false, captured: true, method: 'already-fresh',
                roots: existing.size, pageInfo: net.gridPageInfo.get(key) || null,
            };
        }

        if (navigationTriggered) {
            const capture = await waitForFreshProfileGridCapture();
            if (capture.captured) {
                return {
                    attempted: false, captured: true, method: 'initial-navigation',
                    roots: capture.roots, pageInfo: capture.pageInfo,
                };
            }
        }

        if (pathNorm(location.pathname) !== pathNorm(target)) {
            return { attempted: navigationTriggered, captured: false, method: 'target-not-open', roots: 0, pageInfo: null };
        }

        const alternates = [
            { path: `/${state.username}/tagged/`, method: 'tagged-reentry' },
            { path: `/${state.username}/reels/`, method: 'reels-reentry' },
        ];

        let availableReentryRoutes = 0;
        for (const alternate of alternates) {
            if (!findAnchor(alternate.path)) {

                continue;
            }
            availableReentryRoutes++;

            const away = await go(alternate.path);
            if (!away.ok) {
                continue;
            }

            await sleep(350);

            const back = await go(target);
            if (!back.ok) {
                history.back();
                await waitPath(target, 4000);
                continue;
            }

            const capture = await waitForFreshProfileGridCapture();
            if (capture.captured) {
                return {
                    attempted: true, captured: true, method: alternate.method,
                    roots: capture.roots, pageInfo: capture.pageInfo,
                };
            }
        }

        return {
            attempted: availableReentryRoutes > 0,
            captured: false,
            method: availableReentryRoutes > 0
                ? 'reentry-missed' : 'no-native-reentry-route',
            roots: 0,
            pageInfo: null,
        };
    }
    function profilePublicGapAvoidsSyntheticRelay() {
        // A verified, target-scoped PUBLIC timeline has already ended,
        // but it exposes fewer roots than Instagram's authenticated
        // count. Replaying a captured PROFILE cursor through a
        // userscript-generated Relay request caused server_execution in
        // real Firefox v1.5.91 AND v1.5.92, before any useful next page.
        //
        // Do not initiate another reconstructed PROFILE request in this
        // state. Continue with the genuine browser-native evidence and
        // independently verified archive sources instead. The official
        // media counter alone NEVER proves the missing server end.
        const id = String(state.userId || '');
        const apiId = String(
            state.profileInfo?.pk || state.profileInfo?.id || ''
        ).split('_')[0];
        const publicIds = state.shadow?.rootIds;
        const expected = Number(state.expected);
        return !!id && apiId === id &&
            state.profileInfo?.is_private === false &&
            state.shadow?.applicable === true &&
            state.coverage?.publicShadow === true &&
            state.shadow?.pageInfoEnded === true &&
            String(state.shadow?.profileId || '') === id &&
            publicIds instanceof Set &&
            Number.isSafeInteger(expected) && expected > 0 &&
            publicIds.size > 0 && publicIds.size < expected;
    }

    function profileNativeCompletionRequest(userKey) {
        const initial = net.gridNativeInitialByUser.get(userKey);
        const continuation =
            net.gridNativeContinuationByUser.get(userKey);
        const audit = net.gridNativeAuditByUser.get(userKey);

        // A first-page request and a cursor request may be
        // different persisted queries with different arguments.
        // Both must have succeeded on this target natively.
        function validNative(request) {
            return !!(
                request &&
                (GRID_NAMES.has(request.friendly) ||
                    request.timelineKeyVerified === true) &&
                /^\d+$/.test(request.docId) &&
                request.variables &&
                typeof request.variables === 'object' &&
                request.template &&
                requestTargetsCurrentProfile({
                    variables:request.variables,
                })
            );
        }

        if (!audit || audit.continuation < 1 ||
            !validNative(continuation) ||
            !/^(?:root|nested)$/.test(audit.cursorLocation)) return null;

        const hasFullContract = audit.initial >= 1 && validNative(initial);

        // Resume a target-scoped, actually observed native continuation,
        // even when the first page was also captured. Replaying the whole
        // first-page timeline duplicates work and can push Instagram into
        // server_execution failures without discovering new roots.
        // The cursor must come from the latest fresh, successful native
        // response and from the exact expected timeline connection.
        const pi = net.gridPageInfo?.get(userKey);
        const nativeMap = net.gridByUser?.get(userKey);
        const publicIds = state?.shadow?.rootIds;
        const accountId = String(
            state?.profileInfo?.pk || state?.profileInfo?.id || ''
        ).split('_')[0];
        const timestamp = net.gridCaptureSeenAtByUser?.get(userKey);
        const age = Date.now() - Number(timestamp);
        const expected = Number(state?.expected);
        const cursor = pi?.end_cursor;
        const sameUser = accountId === String(state?.userId || '') &&
            String(state?.shadow?.profileId || '') === String(state?.userId || '');
        const publicPartial = sameUser &&
            state?.profileInfo?.is_private === false &&
            state?.shadow?.applicable === true &&
            state?.shadow?.pageInfoEnded === true &&
            state?.coverage?.publicShadow === true &&
            publicIds instanceof Set &&
            Number.isSafeInteger(expected) && expected > 0 &&
            publicIds.size > 0 && publicIds.size < expected;
        const session = state?.nativeProfileEvidenceSession;
        const sessionAge = Date.now() - Number(session?.acceptedAt);
        const inScan = !!session && session.key === userKey &&
            session.userId === String(state?.userId || '') &&
            Number.isFinite(session.acceptedAt) &&
            Number.isFinite(sessionAge) &&
            sessionAge >= 0 && sessionAge <= 120000 &&
            Number.isFinite(timestamp) &&
            (timestamp === session.acceptedCapturedAt ||
                timestamp >= session.acceptedAt);
        const fresh = Number.isFinite(timestamp) &&
            Number.isFinite(age) && age >= 0 &&
            (age <= APP.PROFILE_BOOTSTRAP_MAX_AGE_MS || inScan);
        const knownQuery = GRID_NAMES.has(continuation.friendly);
        const exactKey = continuation.timelineKeyVerified === true;
        const trusted = exactKey || (hasFullContract && knownQuery);
        const canResume = trusted &&
            audit.lastHasNext === 'true' &&
            pi?.has_next_page === true &&
            typeof cursor === 'string' && !!cursor &&
            fresh && publicPartial &&
            nativeMap instanceof Map && nativeMap.size > 0;
        if (canResume) {
            log('PROFILE native resume selected: ' +
                'mode=' + (hasFullContract ? 'native_resume' : 'observed_tail') +
                ', age_ms=' + Math.round(age) +
                ', same_scan=' + inScan +
                ', known_query=' + knownQuery +
                ', exact_key=' + exactKey +
                ', public=' + publicIds.size + '/' + expected +
                ', native_roots=' + nativeMap.size + '.');
            return {
                initial:hasFullContract ? initial : null,
                continuation,
                mode:hasFullContract ? 'native_resume' : 'observed_tail',
                startCursor:cursor, exactKey,
            };
        }

        // Never replay a known, unfinished PROFILE from its first page
        // after independently finishing PUBLIC SHADOW. This repeatedly
        // requested already-known media, then triggered server_execution.
        if (publicPartial && pi?.has_next_page === true) {
            const reasons = [];
            if (!trusted) reasons.push('continuation_unverified');
            if (audit.lastHasNext !== 'true') reasons.push('next_page_conflict');
            if (!cursor) reasons.push('cursor_missing');
            if (!fresh) reasons.push('outside_current_scan');
            if (!(nativeMap instanceof Map) || !nativeMap.size) {
                reasons.push('native_roots_missing');
            }
            log('PROFILE native resume unavailable: ' +
                (reasons.join(',') || 'insufficient_provenance') +
                '. No full first-page replay. PROFILE remains INCOMPLETE; ' +
                'other independently verified sources can proceed.', 'warn');
            return null;
        }

        return hasFullContract
            ? { initial, continuation, mode:'full', startCursor:null }
            : null;
    }

    function profileCompletionVariables(nativeVariables,cursor=null) {
        const vars = JSON.parse(
            JSON.stringify(nativeVariables || {})
        );

        const root =
            Object.prototype.hasOwnProperty.call(vars,'after');
        const nested = !!(
            vars.data &&
            typeof vars.data === 'object' &&
            Object.prototype.hasOwnProperty.call(vars.data,'after')
        );

        // The native initial page should contain no active
        // continuation cursor. Do not manufacture a reset shape.
        if (!cursor) {
            if (
                (root && vars.after) ||
                (nested && vars.data.after)
            ) return null;
            return vars;
        }

        // Change only the observed cursor, leaving first/count,
        // before/last, Relay providers and every other variable
        // exactly as the successful native continuation used them.
        if (root === nested) return null;
        if (root) vars.after = cursor;
        else vars.data.after = cursor;

        return vars;
    }

    async function scanProfileGraphQLFallback(context = {}) {
        const startOwned = ownedCount();
        const reason = String(context.reason || 'completion');
        const userKey = state.username.toLowerCase();
        const contracts = profileNativeCompletionRequest(userKey);
        const observedDoc = String(
            net.gridDocByUser.get(userKey) || ''
        );
        const audit = net.gridNativeAuditByUser.get(userKey);
        log(
            'PROFILE native provenance: initial=' + (audit?.initial || 0) +
            ', continuation=' + (audit?.continuation || 0) +
            ', cursor_schema=' + (audit?.cursorLocation || 'absent') +
            ', last_has_next=' + (audit?.lastHasNext || 'unknown') + '.'
        );

        if (!contracts) {
            log(
                'PROFILE completion: no verified native continuation ' +
                'contract; grid remains INCOMPLETE.',
                'warn'
            );
            return {
                ended:false, pages:0, edges:0, recovered:0,
                endReason:'native_continuation_unavailable', docId:'',
            };
        }

        const docId = contracts.continuation.docId;
        const tailOnly = contracts.mode === 'observed_tail' ||
            contracts.mode === 'native_resume';
        log(
            'PROFILE verified native Relay completion starting: ' +
            'current=' + startOwned +
            ', reason=' + reason +
            ', initial_doc=' + (contracts.initial?.docId || '-') +
            ', continuation_doc=' + docId +
            ', native_doc=' + (observedDoc || '-') +
            ', mode=' + contracts.mode + '.',
            'warn'
        );

        let cursor = contracts.startCursor || null;
        let gotResponse = false;
        let ended = false;
        let endReason = 'max_pages';
        let pages = 0;
        let totalEdges = 0;
        let stagnantResumePages = 0;
        const seenCursors = new Set(cursor ? [cursor] : []);

        // Native cursor resumes must not duplicate the old full crawl or
        // produce a request storm. Other full fallback paths keep their cap.
        const maxPages = tailOnly
            ? Math.min(4, APP.PROFILE_MAX_SCROLLS)
            : APP.PROFILE_MAX_SCROLLS;
        for (let page = 1; page <= maxPages; page++) {
            if (state.cancelled) throw new Error('Cancelled');

            const contract = cursor
                ? contracts.continuation
                : contracts.initial;
            const vars = profileCompletionVariables(
                contract.variables,cursor
            );
            if (!vars) {
                endReason = 'pagination_arguments_unavailable';
                log(
                    'PROFILE native Relay pagination: no verified ' +
                    'page size to continue; grid remains INCOMPLETE.',
                    'warn'
                );
                break;
            }
            let data;
            try {
                data = await webRelayGql(
                    contract.docId,vars,contract.friendly,{
                        endpoint:contract.endpoint,
                        nativeTemplate:contract.template,
                        rootField:
                            contract.template.headers?.['x-root-field-name'] ||
                            GRID_CONNECTION_KEY,
                    }
                );
                gotResponse = true;
            }
            catch (error) {
                throwIfInstagramStop(error, 'PROFILE native Relay completion');
                endReason = 'graphql_error';
                log(
                    'PROFILE completion request unavailable on page ' +
                    page + '; grid remains INCOMPLETE.',
                    'warn'
                );
                break;
            }

            // Tail-only mode has no captured initial request to validate
            // its connection shape. Require the exact native timeline key.
            const c = tailOnly && contracts.exactKey === true
                ? keyedConnection(data, GRID_CONNECTION_KEY)
                : gridConn(data);
            if (!c || !Array.isArray(c.edges) ||
                typeof c.page_info?.has_next_page !== 'boolean') {
                endReason = 'connection_missing';
                log(
                    'PROFILE completion response lacks the timeline ' +
                    'connection; grid remains INCOMPLETE.',
                    'warn'
                );
                break;
            }

            const edges = c.edges || [];
            pages++;
            totalEdges += edges.length;
            const before = ownedCount();
            const nativeMap = net.gridByUser.get(userKey) || new Map();
            const nativeBefore = nativeMap.size;

            for (const edge of edges) {
                const node = edgeNode(edge);
                const id = normalizePk(node);
                if (tailOnly && !/^\d+$/.test(id)) {
                    endReason = 'native_resume_invalid_identity';
                    break;
                }
                if (tailOnly) nativeMap.set(id,node);
                addMedia(node, '', 'PROFILE_FALLBACK');
            }
            if (endReason === 'native_resume_invalid_identity') break;
            if (tailOnly) net.gridByUser.set(userKey,nativeMap);

            const added = Math.max(0, ownedCount() - before);
            updateStats();
            log(
                'PROFILE native Relay page ' + page +
                ': edges=' + edges.length +
                ', new=' + added +
                ', OWNED=' + ownedCount() +
                ', has_next=' +
                (c?.page_info?.has_next_page ?? 'unknown') + '.'
            );

            if (c?.page_info?.has_next_page === false) {
                if (tailOnly) {
                    const known = new Set([
                        ...state.shadow.rootIds,
                        ...net.gridByUser.get(userKey).keys(),
                    ]);
                    const matched = known.size === Number(state.expected) &&
                        [...known].every(id =>
                            state.roots.POST.has(id) || state.roots.REEL.has(id)
                        );
                    if (!matched) {
                        endReason = 'native_resume_union_counter_unverified';
                        log('PROFILE native cursor ended, but PUBLIC/native ' +
                            'root union=' + known.size +
                            ' does not reconcile to authenticated counter=' +
                            state.expected + ' with resolved root identities. ' +
                            'PROFILE remains INCOMPLETE.', 'warn');
                        break;
                    }
                }
                ended = true;
                endReason = tailOnly
                    ? 'native_resume_page_info_end_exact_union'
                    : 'page_info_end';
                break;
            }

            // A server that keeps advertising more pages while returning
            // the same known 34/34 roots is not a completion proof. In
            // resume mode, stop after two consecutive non-progressing
            // pages instead of provoking repeated server_execution faults.
            if (tailOnly) {
                const nativeUnion = new Set([
                    ...state.shadow.rootIds,
                    ...net.gridByUser.get(userKey).keys(),
                ]);
                const noProgress = added === 0 &&
                    nativeMap.size === nativeBefore &&
                    nativeUnion.size === Number(state.expected);
                stagnantResumePages = noProgress
                    ? stagnantResumePages + 1 : 0;
                if (stagnantResumePages >= 2) {
                    endReason = 'native_resume_stalled_without_server_end';
                    log('PROFILE native cursor returned two consecutive ' +
                        'no-progress pages with exact counter reconciliation, ' +
                        'but still has_next=true. Stopping without a third ' +
                        'request; grid remains INCOMPLETE, other independently ' +
                        'verified sources can proceed.', 'warn');
                    break;
                }
            }

            const next = String(c?.page_info?.end_cursor || '');
            if (!edges.length) {
                endReason = 'empty_page_without_end';
                break;
            }
            if (!next) {
                endReason = 'missing_cursor';
                break;
            }
            if (seenCursors.has(next)) {
                endReason = 'repeated_cursor';
                break;
            }

            seenCursors.add(next);
            cursor = next;
            await sleep(rand(APP.PAGE_MIN, APP.PAGE_MAX));
        }

        const recovered = Math.max(0, ownedCount() - startOwned);
        log(
            'PROFILE native Relay completion: ' +
            'pages=' + pages + ', edges=' + totalEdges +
            ', recovered=' + recovered +
            ', OWNED=' + ownedCount() +
            ', end=' + endReason +
            ', ended=' + (gotResponse && ended) + '.'
        );

        return {
            ended:gotResponse && ended,
            pages, edges:totalEdges, recovered, endReason, docId,
        };
    }
    async function scanMainGrid() {
        log(
            'Scanning native main PROFILE grid (mixed POST + REEL)…'
        );

        status(
            'Scanning native PROFILE grid…'
        );

        const target =
            `/${state.username}/`;

        const oldPath =
            location.pathname;

        const oldY =
            window.scrollY;

        const nav =
            await go(target);

        if (
            !nav.ok &&
            pathNorm(
                location.pathname
            ) !==
            pathNorm(target)
        ) {
            state.coverage.profileGrid = false;

            log(
                'Could not open main PROFILE grid.',
                'warn'
            );

            return false;
        }

        const processed =
            new Set();

        const seenDom =
            new Map();

        let stagnant = 0;
        let last = -1;
        let ended = false;
        let rounds = 0;

        try {
            const prime = await primeProfileGridNativeCapture(
                target,
                nav.navigated
            );

            log(
                `PROFILE native capture: method=${prime.method}, captured=${prime.captured}` +
                (Number.isFinite(prime.roots) ? `, roots=${prime.roots}` : '') +
                '.'
            );

            if (!prime.captured) {
                await sleep(700);
            }

            for (
                let round = 0;
                round < APP.PROFILE_MAX_SCROLLS;
                round++
            ) {
                rounds = round + 1;
                if (
                    state.cancelled
                ) {
                    throw new Error(
                        'Cancelled'
                    );
                }

                const map =
                    net.gridByUser.get(
                        state.username
                            .toLowerCase()
                    ) ||
                    new Map();

                for (
                    const [k, n]
                    of map
                ) {
                    if (
                        processed.has(k)
                    ) {
                        continue;
                    }

                    processed.add(k);

                    addMedia(
                        n,
                        '',
                        'PROFILE_GRID_NATIVE'
                    );
                }

                for (
                    const [k, v]
                    of profileLinks()
                ) {
                    seenDom.set(k, v);
                }

                updateStats();

                const metric =
                    map.size +
                    seenDom.size;

                if (
                    metric === last
                ) {
                    stagnant++;
                }

                else {
                    stagnant = 0;
                    last = metric;
                }

                const pi =
                    net.gridPageInfo.get(
                        state.username
                            .toLowerCase()
                    );

                const atBottom =
                    window.scrollY >=
                    Math.max(
                        0,
                        document
                            .documentElement
                            .scrollHeight -
                        window.innerHeight
                    ) -
                    20;

                /*
                 * Never infer completeness from DOM stagnation alone. A lost
                 * connection can leave us at the visual bottom while Instagram
                 * still has more pages. The native pass accepts only an explicit
                 * page_info end. scanMainGrid() first forces a fresh native
                 * route re-entry when needed. Only if native capture still
                 * cannot prove the end does it ask the connected feed for an
                 * independent paginated proof. The global counter is never
                 * used as a completion proof.
                 */
                if (
                    pi?.has_next_page === false
                ) {
                    ended = true;
                    break;
                }

                if (
                    atBottom &&
                    pi?.has_next_page !== false &&
                    stagnant >= 3
                ) {
                    log(
                        `PROFILE grid stalled at the visual bottom without ` +
                        `native page_info_end; leaving native pass for ` +
                        `PROFILE GraphQL completion.`,
                        'warn'
                    );
                    break;
                }

                const progressBaseline =
                    currentProfileGridProgress();

                window.scrollTo({
                    top:
                        document.body
                            .scrollHeight,

                    behavior:
                        'auto',
                });

                await waitForProfileGridProgress(
                    progressBaseline
                );
            }

            const map =
                net.gridByUser.get(
                    state.username
                        .toLowerCase()
                ) ||
                new Map();

            for (
                const [k, n]
                of map
            ) {
                if (
                    !processed.has(k)
                ) {
                    processed.add(k);

                    addMedia(
                        n,
                        '',
                        'PROFILE_GRID_NATIVE'
                    );
                }
            }

            for (
                const [k, v]
                of profileLinks()
            ) {
                seenDom.set(k, v);
            }

            const finalPi =
                net.gridPageInfo.get(
                    state.username.toLowerCase()
                );

            const nativeEnded =
                finalPi?.has_next_page ===
                    false ||
                ended;

            const completionRequirement =
                profileCompletionRequirement({
                    primeCaptured:
                        prime.captured ===
                        true,

                    nativeEnded,

                    nativeOwned:
                        ownedCount(),

                    expected:
                        state.expected,
                });

            let navigationEnded =
                nativeEnded;

            if (
                completionRequirement.required
            ) {
                const reason =
                    completionRequirement
                        .reasons
                        .join('+');

                log(
                    `PROFILE canonical completion required: ${reason}.`,
                    'warn'
                );

                if (profilePublicGapAvoidsSyntheticRelay()) {
                    // Both 1.5.91 and 1.5.92 received server_execution
                    // on the first reconstructed PROFILE continuation.
                    // Never turn 34/34 observed roots into a fabricated
                    // terminal page, and never poison the other sources
                    // with another unnecessary GraphQL API failure.
                    navigationEnded = false;
                    log(
                        'PROFILE native Relay replay skipped: verified ' +
                        'PUBLIC source ended at ' +
                        state.shadow.rootIds.size + '/' + state.expected +
                        ', but authenticated PROFILE completion is ' +
                        'unproven. No script-generated PROFILE GraphQL; ' +
                        'continuing other independently verified surfaces. ' +
                        'PROFILE remains INCOMPLETE until native server-end ' +
                        'or later strict cross-surface proof.',
                        'warn'
                    );
                }
                else {
                    const fallback =
                        await scanProfileGraphQLFallback({
                            reason,
                            preferCanonicalDoc:
                                true,
                        });

                    /*
                     * Once canonical completion is requested, ONLY its
                     * own pagination result may prove the end. Never OR
                     * it with stale/partial native page_info=false.
                     */
                    navigationEnded =
                        fallback.ended ===
                        true;
                }
            }

            /*
             * Reconcile the visible DOM only after the PROFILE GraphQL pass.
             * A successful completion pass can recover roots that the native
             * hook missed, avoiding unnecessary media-info hydration requests.
             */
            const have =
                ownedIds();

            const missing =
                [...seenDom.values()]
                    .filter(
                        x => {
                            const id =
                                String(
                                    x?.mediaId ||
                                    ''
                                );

                            return (
                                id &&
                                !have.has(id)
                            );
                        }
                    );

            let domHydration = {
                attempted: 0,
                resolved: 0,
                failed: 0,
            };

            if (
                missing.length
            ) {
                log(
                    `PROFILE grid native/GraphQL capture missed ` +
                    `${missing.length} visible roots; hydrating them.`,
                    'warn'
                );

                domHydration =
                    await hydratePermalinkRoots(
                        missing,
                        'PROFILE_GRID_DOM'
                    );
            }

            // Freeze main-grid root IDs BEFORE independent REELS scanning.
            // Links seen in DOM are candidates, not authentication proof.
            state.profileDomObservedRootIds = new Set(
                [...seenDom.keys()].filter(id => /^\d+$/.test(String(id)))
            );
            state.profileMainGridRootIds = new Set([
                ...state.roots.POST, ...state.roots.REEL
            ]);
            state.coverage.profileGrid =
                navigationEnded &&
                domHydration.failed === 0;

            if (
                !navigationEnded &&
                rounds >= APP.PROFILE_MAX_SCROLLS
            ) {
                log(
                    `PROFILE grid safety cap reached (${APP.PROFILE_MAX_SCROLLS} scrolls) ` +
                    `before Instagram reported the end; scan remains INCOMPLETE.`,
                    'warn'
                );
            }

            if (domHydration.failed > 0) {
                log(
                    `PROFILE grid incomplete: ` +
                    `${domHydration.failed}/${domHydration.attempted} ` +
                    `visible DOM roots could not be resolved.`,
                    'warn'
                );
            }

            updateStats();

            log(
                `Main PROFILE grid: ` +
                `POST=${state.roots.POST.size}, ` +
                `REEL=${state.roots.REEL.size}, ` +
                `OWNED=${ownedCount()}` +
                (
                    state.expected
                        ? `/${state.expected}`
                        : ''
                ) +
                `, ended=${state.coverage.profileGrid}.`
            );

            return state.coverage.profileGrid;
        }

        finally {
            await restore(
                oldPath,
                oldY,
                nav.navigated
            );
        }
    }

    function currentReelsProgress() {
        const map =
            net.reelsByUserId.get(
                state.userId
            ) ||
            new Map();

        const pi =
            net.reelPageInfo.get(
                state.userId
            );

        return {
            network: map.size,
            height: Math.max(
                document.body?.scrollHeight || 0,
                document.documentElement?.scrollHeight || 0
            ),
            hasNext: pi?.has_next_page,
            cursor: String(pi?.end_cursor || ''),
        };
    }

    async function waitForReelsProgress(baseline) {
        const started = Date.now();

        await sleep(APP.REEL_SCROLL_MIN);

        while (
            Date.now() - started <
            APP.REEL_SCROLL_MAX
        ) {
            if (state.cancelled) {
                throw new Error('Cancelled');
            }

            const current =
                currentReelsProgress();

            if (
                current.network > baseline.network ||
                current.height > baseline.height ||
                current.cursor !== baseline.cursor ||
                current.hasNext !== baseline.hasNext
            ) {
                return true;
            }

            await sleep(APP.REEL_SCROLL_POLL);
        }

        return false;
    }


    // Feedback_required observed in Firefox from the private-mobile
    // clips/user/ endpoint. This desktop userscript must NEVER replay that
    // endpoint: it requires a distinct mobile-app auth/signature context.
    // Native Web REELS capture remains the only verified discovery route.
    // An absent tab is operationally skipped after strict cross-surface
    // reconciliation; it is not evidence of an empty REELS feed.
    async function scanReels() {
        log(
            'Scanning native REELS tab…'
        );

        status(
            'Scanning REEL…'
        );

        const target =
            `/${state.username}/reels/`;

        const oldPath =
            location.pathname;

        const oldY =
            window.scrollY;

        // A missing visible REELS tab is not a server-side
        // empty-reels proof. Do not query fallback GraphQL without a
        // native navigation entry to substantiate the media surface.
        if (
            pathNorm(location.pathname) !== pathNorm(target) &&
            !findAnchor(target)
        ) {
            const cached = net.reelsByUserId.get(state.userId) || new Map();
            const audit = net.reelNativeAuditByUserId.get(state.userId);
            let resolved = 0;
            let unresolved = 0;

            // A missing tab is not permission to issue another request.
            // Preserve media from real Web responses observed before this
            // scan, provided they were scoped to the current profile. Each
            // media unit still needs an exact source-to-file proof.
            if (audit?.initial >= 1) {
                for (const raw of cached.values()) {
                    const rootId = normalizePk(raw);
                    if (!/^\d+$/.test(rootId)) {
                        unresolved++;
                        continue;
                    }
                    addMedia(raw, 'REEL', 'REEL_NATIVE_OBSERVED');
                    if (
                        discoveredMediaResolution(
                            raw, 'REEL_NATIVE_OBSERVED'
                        ).ok
                    ) {
                        state.verifiedPassiveReelRootIds.add(rootId);
                        resolved++;
                    }
                    else {
                        unresolved++;
                    }
                }
            }

            state.coverage.reels = false;
            log(
                'REELS tab absent: native_observed=' + resolved +
                ', native_unresolved=' + unresolved +
                '. Individual verified media can enter ACCESSIBLE PARTIAL; ' +
                'this does NOT prove the complete REELS feed. No new ' +
                'REELS request or private mobile clips/user/ probe. ' +
                'REELS surface skipped if other selected sources verify; ' +
                'absence is NOT proof of zero clips.',
                'warn'
            );
            updateStats();
            return false;
        }

        const nav =
            await go(target);

        if (
            !nav.ok &&
            pathNorm(
                location.pathname
            ) !==
            pathNorm(target)
        ) {
            state.coverage.reels = false;
            log(
                'Could not open REELS tab. No verified native REELS ' +
                'pagination was captured; REELS stays INCOMPLETE. ' +
                'Skipping obsolete static GraphQL fallback.',
                'warn'
            );
            updateStats();
            return false;
        }

        const processed =
            new Set();

        const seenDom =
            new Map();

        let stagnant = 0;
        let last = -1;
        let nativeEnded = false;
        let nativeEndReason = 'max_scrolls';

        try {
            await sleep(900);

            for (
                let round = 0;
                round < APP.REEL_MAX_SCROLLS;
                round++
            ) {
                if (
                    state.cancelled
                ) {
                    throw new Error(
                        'Cancelled'
                    );
                }

                const map =
                    net.reelsByUserId.get(
                        state.userId
                    ) ||
                    new Map();

                for (
                    const [k, n]
                    of map
                ) {
                    if (
                        processed.has(k)
                    ) {
                        continue;
                    }

                    processed.add(k);

                    /*
                     * IMPORTANT:
                     * no "owner == target" filter here.
                     *
                     * The native Reels request is already scoped to
                     * target_user_id. Collaboration Reels may have another
                     * account as primary media owner while still belonging
                     * on the target profile.
                     */
                    addMedia(
                        n,
                        'REEL',
                        'REEL_NATIVE'
                    );
                }

                for (
                    const [k, v]
                    of profileLinks()
                ) {
                    if (
                        v.route ===
                        'reel'
                    ) {
                        seenDom.set(
                            k,
                            v
                        );
                    }
                }

                updateStats();

                const metric =
                    map.size +
                    seenDom.size;

                if (
                    metric === last
                ) {
                    stagnant++;
                }

                else {
                    stagnant = 0;
                    last = metric;
                }

                const pi =
                    net.reelPageInfo.get(
                        state.userId
                    );

                const atBottom =
                    window.scrollY >=
                    Math.max(
                        0,
                        document
                            .documentElement
                            .scrollHeight -
                        window.innerHeight
                    ) -
                    20;

                if (
                    pi?.has_next_page ===
                        false
                ) {
                    /*
                     * GraphQL completion remains mandatory immediately after
                     * this native pass. Once Instagram itself says there is
                     * no native continuation cursor, extra stagnant rounds do
                     * not improve completeness; the GraphQL pass is the guard.
                     */
                    nativeEnded = true;
                    nativeEndReason =
                        'page_info_end';
                    break;
                }

                if (
                    atBottom &&
                    stagnant >= 4
                ) {
                    /*
                     * Reaching the visual bottom is NOT proof that the API
                     * has no more Reels. Instagram can temporarily stop
                     * extending the DOM while page_info still advertises a
                     * continuation cursor. We stop the native scroll here,
                     * but the GraphQL completion pass below remains mandatory.
                     */
                    nativeEndReason =
                        pi?.has_next_page === true
                            ? 'bottom_stagnant_has_next'
                            : 'bottom_stagnant_unknown';
                    break;
                }

                /*
                 * Do NOT stop merely because OWNED reached the
                 * profile counter. Reels hidden from the main grid
                 * can still exist in the Reels tab and are part of
                 * the archive we want.
                 */
                const reelsProgressBaseline =
                    currentReelsProgress();

                window.scrollTo({
                    top:
                        document.body
                            .scrollHeight,

                    behavior:
                        'auto',
                });

                await waitForReelsProgress(
                    reelsProgressBaseline
                );
            }

            const map =
                net.reelsByUserId.get(
                    state.userId
                ) ||
                new Map();

            for (
                const [k, n]
                of map
            ) {
                if (
                    !processed.has(k)
                ) {
                    processed.add(k);

                    addMedia(
                        n,
                        'REEL',
                        'REEL_NATIVE'
                    );
                }
            }

            for (
                const [k, v]
                of profileLinks()
            ) {
                if (
                    v.route ===
                    'reel'
                ) {
                    seenDom.set(
                        k,
                        v
                    );
                }
            }

            const missing =
                [...seenDom.values()]
                    .filter(
                        x => {
                            const id =
                                String(
                                    x?.mediaId ||
                                    ''
                                );

                            return (
                                id &&
                                !state.roots
                                    .REEL
                                    .has(id)
                            );
                        }
                    );

            if (
                missing.length
            ) {
                log(
                    `REEL capture missed ` +
                    `${missing.length} visible roots; hydrating them.`,
                    'warn'
                );

                await hydratePermalinkRoots(
                    missing,
                    'REEL_DOM'
                );
            }

            const nativeRoots =
                state.roots.REEL.size;

            const finalPi =
                net.reelPageInfo.get(
                    state.userId
                );

            if (
                finalPi?.has_next_page ===
                    false
            ) {
                nativeEnded = true;

                if (
                    nativeEndReason ===
                    'max_scrolls'
                ) {
                    nativeEndReason =
                        'page_info_end';
                }
            }

            log(
                `REELS native pass: ` +
                `roots=${nativeRoots}, ` +
                `network=${processed.size}, ` +
                `dom=${seenDom.size}, ` +
                `page_has_next=${finalPi?.has_next_page ?? 'unknown'}, ` +
                `reason=${nativeEndReason}.`
            );

            // Do not use the old fixed REELS GraphQL doc_id. A native
            // server-end is sufficient only when its target-scoped request
            // was observed; otherwise replay only a VERIFIED native cursor
            // contract. Missing evidence leaves REELS INCOMPLETE.
            const completed =
                await scanReelsNativeCompletion({
                    reason: nativeEndReason,
                    nativeRoots,
                    nativeEnded,
                });

            /*
             * Anti-loss cross-check: every REEL visibly present in the native
             * DOM must also be represented in the final exhaustive REEL root
             * set. A verified native server end is necessary, but it must
             * not override evidence of a visible root that still could not be
             * resolved.
             */
            const unresolvedVisible =
                [...seenDom.values()]
                    .filter(x => {
                        const id =
                            String(
                                x?.mediaId ||
                                ''
                            );

                        return (
                            id &&
                            !state.roots.REEL.has(id)
                        );
                    });

            if (unresolvedVisible.length) {
                state.coverage.reels = false;

                log(
                    `REELS incomplete: ${unresolvedVisible.length} visible DOM root(s) ` +
                    `remain unresolved after verified native completion.`,
                    'warn'
                );
            }

            const verifiedComplete =
                completed &&
                unresolvedVisible.length === 0;

            state.coverage.reels = verifiedComplete;

            updateStats();

            log(
                `REELS tab complete: ` +
                `${state.roots.REEL.size} unique REEL roots; ` +
                `OWNED=${ownedCount()}` +
                (
                    state.expected
                        ? `/${state.expected}`
                        : ''
                ) +
                `, visible_unresolved=${unresolvedVisible.length}, ` +
                `ended=${verifiedComplete}.`
            );

            return verifiedComplete;
        }

        finally {
            await restore(
                oldPath,
                oldY,
                nav.navigated
            );
        }
    }

    function verifiedReelNativeContinuation(uid) {
        const initial = net.reelNativeInitialByUserId.get(uid);
        const continuation = net.reelNativeContinuationByUserId.get(uid);
        const audit = net.reelNativeAuditByUserId.get(uid);

        const valid = contract => !!(
            contract &&
            REEL_NAMES.has(contract.friendly) &&
            /^\d+$/.test(contract.docId) &&
            contract.variables &&
            typeof contract.variables === 'object' &&
            contract.template?.body &&
            typeof contract.template.body === 'object' &&
            requestTargetsCurrentProfile({
                variables: contract.variables,
            })
        );

        if (
            !audit ||
            audit.initial < 1 ||
            audit.continuation < 1 ||
            !valid(initial) ||
            !valid(continuation) ||
            !['after','max_id','data.after','data.max_id'].includes(
                continuation.cursorPath
            )
        ) return null;

        const observed = reelNativeCursorField(continuation.variables);
        if (
            !observed ||
            observed.path !== continuation.cursorPath ||
            !observed.value
        ) return null;

        return continuation;
    }

    function reelNativeContinuationVariables(contract, cursor) {
        if (!contract || !cursor) return null;

        const vars = JSON.parse(JSON.stringify(contract.variables || {}));
        const field = String(contract.cursorPath || '');
        const rootField = field === 'after' || field === 'max_id';
        const nestedField = field === 'data.after' || field === 'data.max_id';
        if (rootField === nestedField) return null;

        const target = rootField ? vars : vars.data;
        const key = field.split('.').pop();
        if (!target || !Object.prototype.hasOwnProperty.call(target, key)) {
            return null;
        }

        const observed = reelNativeCursorField(vars);
        if (!observed || observed.path !== field || !observed.value) return null;

        target[key] = String(cursor);
        return vars;
    }

    async function scanReelsNativeCompletion(context = {}) {
        const uid = String(state.userId || '');
        const audit = net.reelNativeAuditByUserId.get(uid);
        const pageInfo = net.reelPageInfo.get(uid);
        const startRoots = state.roots.REEL.size;

        if (
            pageInfo?.has_next_page === false &&
            audit?.initial >= 1 &&
            audit?.lastHasNext === 'false'
        ) {
            log(
                'REELS native pagination ended on target-scoped ' +
                'Instagram page_info.has_next_page=false; no GraphQL ' +
                'fallback required.'
            );
            return true;
        }

        const firstCursor = String(pageInfo?.end_cursor || '');
        const contract = verifiedReelNativeContinuation(uid);

        log(
            'REELS native completion: reason=' +
            String(context.reason || 'unknown') +
            ', roots=' + startRoots +
            ', initial=' + (audit?.initial || 0) +
            ', continuation=' + (audit?.continuation || 0) +
            ', cursor_schema=' + (audit?.cursorPath || '-') +
            ', has_next=' + (pageInfo?.has_next_page ?? 'unknown') +
            ', verified_contract=' + !!contract + '.',
            'warn'
        );

        if (
            pageInfo?.has_next_page !== true ||
            !firstCursor ||
            !contract
        ) {
            log(
                'REELS completion: missing server-side end or verified ' +
                'native continuation contract. Preserving discovered ' +
                'media but leaving REELS INCOMPLETE. Obsolete static ' +
                'GraphQL fallback was NOT requested.',
                'warn'
            );
            return false;
        }

        let cursor = firstCursor;
        let completed = false;
        let pages = 0;
        let edges = 0;
        let endReason = 'limit';
        const seen = new Set();

        for (let page = 1; page <= APP.REEL_MAX_SCROLLS; page++) {
            if (state.cancelled) throw new Error('Cancelled');

            if (seen.has(cursor)) {
                endReason = 'cursor_repeated';
                break;
            }
            seen.add(cursor);

            const vars = reelNativeContinuationVariables(contract, cursor);
            if (!vars) {
                endReason = 'invalid_native_cursor_contract';
                break;
            }

            let response;
            try {
                response = await webRelayGql(
                    contract.docId,
                    vars,
                    contract.friendly,
                    {
                        endpoint:contract.endpoint,
                        nativeTemplate:contract.template,
                        rootField:
                            contract.template.headers?.['x-root-field-name'] ||
                            REEL_CONNECTION_KEY,
                    }
                );
            }
            catch (e) {
                // A real, identity-scoped authenticated native request that
                // returns 429/feedback_required/HTML must still trigger the
                // existing safety circuit; never pretend it was an empty page.
                throwIfInstagramStop(e, 'REELS verified native pagination');
                endReason = 'native_relay_request_failed';
                log(
                    'REELS verified native pagination request failed; ' +
                    'leaving REELS INCOMPLETE.',
                    'warn'
                );
                break;
            }

            const c = reelConn(response);
            if (!c || !Array.isArray(c.edges)) {
                endReason = 'connection_missing';
                break;
            }

            pages++;
            edges += c.edges.length;
            const before = state.roots.REEL.size;
            for (const edge of c.edges) {
                addMedia(edgeNode(edge), 'REEL', 'REEL_NATIVE_RELAY');
            }
            const recovered = state.roots.REEL.size - before;
            updateStats();
            log(
                'REELS verified native page ' + page +
                ': edges=' + c.edges.length +
                ', new=' + recovered +
                ', total=' + state.roots.REEL.size +
                ', has_next=' +
                (c?.page_info?.has_next_page ?? 'unknown') + '.'
            );

            if (c?.page_info?.has_next_page === false) {
                completed = true;
                endReason = 'server_page_info_end';
                break;
            }

            const next = String(c?.page_info?.end_cursor || '');
            if (!c.edges.length || !next) {
                endReason = !c.edges.length
                    ? 'empty_page_without_end'
                    : 'missing_cursor';
                break;
            }

            cursor = next;
            await sleep(rand(APP.PAGE_MIN, APP.PAGE_MAX));
        }

        log(
            'REELS verified native completion: pages=' + pages +
            ', edges=' + edges +
            ', recovered=' + (state.roots.REEL.size-startRoots) +
            ', end=' + endReason +
            ', ended=' + completed + '.',
            completed ? 'info' : 'warn'
        );
        return completed;
    }


    // A metadata count alone cannot identify an invisible fourth slide.
    // Reconcile only TWO authenticated, same-root, explicitly enumerated
    // versions of the same TAGGED carousel. Never fabricate a child ID.
    function taggedAccessibleCarouselProof(listing, detailed) {
        const fail = reason => ({ok:false, reason});
        const a = listing?.media && typeof listing.media === 'object'
            ? listing.media : listing;
        const b = detailed?.media && typeof detailed.media === 'object'
            ? detailed.media : detailed;
        const parent = normalizePk(a);
        if (!/^\d+$/.test(parent) || normalizePk(b) !== parent) {
            return fail('parent_identity_mismatch');
        }
        const carousel = x => Number(x?.media_type) === 8 ||
            x?.__typename === 'GraphSidecar' ||
            ['carousel','carousel_container'].includes(String(
                x?.product_type || x?.media_product_type || ''
            ).toLowerCase());
        if (!carousel(a) || !carousel(b)) {
            return fail('not_both_carousels');
        }
        const count = Number(a.carousel_media_count);
        const side = x => x?.edge_sidecar_to_children;
        const children = x => Array.isArray(x?.carousel_media) &&
            x.carousel_media.length
                ? x.carousel_media
                : (side(x)?.edges || []).map(e => e?.node).filter(Boolean);
        const aa = children(a), bb = children(b);
        if (!Number.isSafeInteger(count) || count <= aa.length ||
            aa.length < 2 || bb.length !== aa.length) {
            return fail('not_a_matching_count_hint');
        }
        const secondClaim = b.carousel_media_count == null ||
            b.carousel_media_count === '' ? 0 : Number(b.carousel_media_count);
        if (!Number.isSafeInteger(secondClaim) ||
            (secondClaim !== 0 && secondClaim !== count &&
                secondClaim !== bb.length)) {
            return fail('detailed_count_conflict');
        }
        if ([a,b].some(x =>
            side(x)?.page_info?.has_next_page === true ||
            Number(x?.carousel_media_pending_post_count || 0) > 0
        )) return fail('pending_or_paginated_children');
        const idOf = x => typeof x === 'string' && /^\d+$/.test(x)
            ? x : normalizePk(x);
        const ids = arr => arr.map(idOf);
        const ai = ids(aa), bi = ids(bb);
        const aSet = new Set(ai), bSet = new Set(bi);
        if (ai.some(id => !/^\d+$/.test(id)) ||
            bi.some(id => !/^\d+$/.test(id)) ||
            aSet.size !== ai.length || bSet.size !== bi.length ||
            ai.length !== bi.length ||
            ai.some(id => !bSet.has(id))) {
            return fail('child_identity_mismatch');
        }
        // API representations may legitimately return the same genuine
        // children in a different order. Verify types by ID, not position.
        const sameOrder = ai.every((id,i) => id === bi[i]);
        const bById = new Map(bb.map(child => [idOf(child), child]));
        // Some Instagram response shapes expose an independent full ID
        // inventory. It must not contradict the displayed child arrays.
        for (const x of [a,b]) {
            if (Array.isArray(x?.carousel_media_ids) &&
                x.carousel_media_ids.length) {
                const extraIds = ids(x.carousel_media_ids);
                if (extraIds.length !== ai.length ||
                    new Set(extraIds).size !== ai.length ||
                    extraIds.some(id => !aSet.has(id))) {
                    return fail('independent_child_ids_conflict');
                }
            }
            if (Array.isArray(x?.edge_sidecar_to_children?.edges) &&
                x.edge_sidecar_to_children.edges.length) {
                const edgeIds = ids(x.edge_sidecar_to_children.edges
                    .map(e => e?.node));
                if (edgeIds.length !== ai.length ||
                    new Set(edgeIds).size !== ai.length ||
                    edgeIds.some(id => !aSet.has(id))) {
                    return fail('sidecar_children_conflict');
                }
            }
        }
        const aOwner = normalizePk(a?.user);
        const bOwner = normalizePk(b?.user);
        if (aOwner && bOwner && aOwner !== bOwner) {
            return fail('owner_identity_mismatch');
        }
        const aCode = String(a.code || a.shortcode || '');
        const bCode = String(b.code || b.shortcode || '');
        if (aCode && bCode && aCode !== bCode) {
            return fail('shortcode_mismatch');
        }
        for (let i = 0; i < aa.length; i++) {
            const c = aa[i], d = bById.get(ai[i]);
            if ((c?.carousel_parent_id && idOf(c.carousel_parent_id) !== parent) ||
                (d?.carousel_parent_id && idOf(d.carousel_parent_id) !== parent)) {
                return fail('child_parent_mismatch');
            }
            const ca = Number(c?.media_type), cb = Number(d?.media_type);
            if (Number.isInteger(ca) && ca > 0 &&
                Number.isInteger(cb) && cb > 0 && ca !== cb) {
                return fail('child_type_conflict');
            }
            if (Number(c?.deleted_reason || 0) > 0 ||
                Number(d?.deleted_reason || 0) > 0) {
                return fail('deleted_child_referenced');
            }
        }
        return {ok:true, reason:'verified_accessible_count_hint_mismatch',
            rootId:parent, declared:count, accessible:ai.length, sameOrder};
    }



    // An authenticated media-info response can contain a *full* parent
    // carousel_media_ids inventory even when carousel_media has fewer
    // downloadable objects. The fourth ID is REAL, but its accessibility is
    // not proved by this inventory alone. Permit one bounded same-origin
    // per-child media-info check, never an inferred or guessed ID.
    function taggedExplicitMissingChildCandidate(listing, detailed) {
        const fail = reason => ({ok:false, reason});
        const a = listing?.media && typeof listing.media === 'object'
            ? listing.media : listing;
        const b = detailed?.media && typeof detailed.media === 'object'
            ? detailed.media : detailed;
        const parent = normalizePk(a);
        if (!/^\d+$/.test(parent) || normalizePk(b) !== parent) {
            return fail('parent_identity_mismatch');
        }
        const isCarousel = x => Number(x?.media_type) === 8 ||
            x?.__typename === 'GraphSidecar';
        if (!isCarousel(a) || !isCarousel(b)) {
            return fail('not_both_carousels');
        }
        const declared = Number(a?.carousel_media_count);
        if (!Number.isSafeInteger(declared) ||
            declared < 3 || declared > 30 ||
            Number(b?.carousel_media_count) !== declared) {
            return fail('not_equal_safe_declared_counts');
        }
        if ([a,b].some(x =>
            x?.edge_sidecar_to_children?.page_info?.has_next_page === true ||
            Number(x?.carousel_media_pending_post_count || 0) > 0
        )) return fail('pending_or_paginated_children');
        if (normalizePk(a?.user) && normalizePk(b?.user) &&
            normalizePk(a.user) !== normalizePk(b.user)) {
            return fail('owner_identity_mismatch');
        }
        const codeA = String(a?.code || a?.shortcode || '');
        const codeB = String(b?.code || b?.shortcode || '');
        if (codeA && codeB && codeA !== codeB) {
            return fail('shortcode_mismatch');
        }
        const elements = x => Array.isArray(x?.carousel_media) &&
            x.carousel_media.length ? x.carousel_media :
            (x?.edge_sidecar_to_children?.edges || [])
                .map(e => e?.node).filter(Boolean);
        const rawId = x => typeof x === 'string' && /^\d+$/.test(x)
            ? x : normalizePk(x);
        const left = elements(a), right = elements(b);
        const leftIds = left.map(rawId), rightIds = right.map(rawId);
        const validSet = ids => ids.length > 0 &&
            ids.every(id => /^\d+$/.test(id)) &&
            new Set(ids).size === ids.length;
        if (!validSet(leftIds) || !validSet(rightIds) ||
            leftIds.length !== declared - 1 ||
            rightIds.length !== declared - 1 ||
            leftIds.some(id => !rightIds.includes(id))) {
            return fail('not_same_declared_minus_one_children');
        }
        const knownById = new Map(right.map(c => [rawId(c),c]));
        for (const c of left) {
            const id = rawId(c), d = knownById.get(id);
            if (c?.carousel_parent_id &&
                String(c.carousel_parent_id).split('_')[0] !== parent) {
                return fail('listing_child_parent_conflict');
            }
            if (d?.carousel_parent_id &&
                String(d.carousel_parent_id).split('_')[0] !== parent) {
                return fail('detailed_child_parent_conflict');
            }
            if (Number(c?.deleted_reason || 0) > 0 ||
                Number(d?.deleted_reason || 0) > 0) {
                return fail('deleted_child_in_array');
            }
            const ca = Number(c?.media_type), cb = Number(d?.media_type);
            if (ca > 0 && cb > 0 && ca !== cb) {
                return fail('known_child_type_mismatch');
            }
        }
        const inventory = Array.isArray(b?.carousel_media_ids)
            ? b.carousel_media_ids.map(rawId) : [];
        if (!validSet(inventory) || inventory.length !== declared ||
            leftIds.some(id => !inventory.includes(id))) {
            return fail('incomplete_or_conflicting_inventory');
        }
        if (Array.isArray(a?.carousel_media_ids) &&
            a.carousel_media_ids.length) {
            const listingInventory = a.carousel_media_ids.map(rawId);
            if (!validSet(listingInventory) ||
                listingInventory.length !== declared ||
                listingInventory.some(id => !inventory.includes(id))) {
                return fail('listing_inventory_conflict');
            }
        }
        // A sidecar edge list, when exposed independently, must identify
        // exactly the known three or the full inventory; never contradict.
        for (const x of [a,b]) {
            const edges = x?.edge_sidecar_to_children?.edges;
            if (!Array.isArray(edges) || !edges.length) continue;
            const ids = edges.map(e => rawId(e?.node));
            if (!validSet(ids) ||
                ![declared - 1,declared].includes(ids.length) ||
                ids.some(id => !inventory.includes(id))) {
                return fail('sidecar_inventory_conflict');
            }
        }
        const missing = inventory.filter(id => !rightIds.includes(id));
        if (missing.length !== 1) {
            return fail('not_exactly_one_independent_child');
        }
        return {
            ok:true, reason:'one_server_enumerated_child_not_materialized',
            rootId:parent, childId:missing[0],
            declared, known:rightIds.length
        };
    }

    // Strict authentication of the independently enumerated child: a
    // successful HTTP response is never enough unless it names that exact
    // ID, agrees with any explicit parent and owner, and offers media data.
    function taggedValidateExplicitChild(parent, childId, child) {
        if (!/^\d+$/.test(String(childId || '')) ||
            normalizePk(child) !== String(childId)) {
            return {ok:false,reason:'child_identity_mismatch'};
        }
        const parentId = normalizePk(parent);
        const declaredParent = String(child?.carousel_parent_id ||
            child?.parent_media_id || '').split('_')[0];
        if (declaredParent && declaredParent !== parentId) {
            return {ok:false,reason:'child_parent_identity_mismatch'};
        }
        const owner = normalizePk(parent?.user);
        const childOwner = normalizePk(child?.user);
        if (owner && childOwner && owner !== childOwner) {
            return {ok:false,reason:'child_owner_identity_mismatch'};
        }
        const type = Number(child?.media_type);
        if (![1,2].includes(type) ||
            Number(child?.deleted_reason || 0) > 0) {
            return {ok:false,reason:'child_type_or_deleted_conflict'};
        }
        const url = type === 2 ? bestVideo(child) :
            bestImage(child,false);
        if (!url || !/^https:\/\//i.test(String(url))) {
            return {ok:false,reason:'child_downloadable_media_unavailable'};
        }
        return {ok:true,reason:'authenticated_independent_child'};
    }

    // Preserve archive filenames when a currently TAGGED-only unit had a
    // previously verified native PROFILE POST identity. This is historical
    // folder continuity only: do NOT add PROFILE roots or fake live proof.
    function restoreHistoricalTaggedPostArchive(root) {
        if (!state.userId) return 0;
        const prior = loadDb()?.profiles?.[state.userId]?.media || {};
        const items = Array.isArray(root?.carousel_media) &&
            root.carousel_media.length
                ? root.carousel_media
                : (root?.edge_sidecar_to_children?.edges || [])
                    .map(e => e?.node).filter(Boolean);
        const units = items.length ? items : [root];
        let restored = 0;
        for (const child of units) {
            const id = normalizePk(child);
            const rec = state.queue.get(id);
            const previous = prior[id];
            if (!rec || rec.type !== 'TAGGED' ||
                !(rec.sources instanceof Set) || !rec.sources.has('TAGGED') ||
                previous?.type !== 'POST' ||
                !Array.isArray(previous.sources) ||
                !previous.sources.includes('PROFILE_GRID_NATIVE') ||
                !Number.isSafeInteger(Number(previous.timestamp)) ||
                Number(previous.timestamp) <= 0 ||
                !['jpg','mp4'].includes(String(rec.ext || '').toLowerCase()) ||
                !String(previous.shortcode || '') ||
                !String(rec.shortcode || '') ||
                canonicalShortcode(previous.shortcode) !==
                    canonicalShortcode(rec.shortcode)) continue;
            const timestamp = Number(previous.timestamp);
            const expectedFilename = filename({
                ...rec,type:'POST',timestamp
            });
            if (String(previous.filename || '') !== expectedFilename) continue;

            rec.type = 'POST';
            rec.timestamp = timestamp;
            rec.filename = expectedFilename;
            rec.historicalPostArchiveContinuity = true;
            restored++;
        }
        return restored;
    }

    // A server pagination end proves the LIST ended, not that each item
    // became an archived file. Validate each returned unit by exact ID and
    // source provenance, including sidecars and previously indexed files.
    // Never request extra data merely to make this check pass.
    function discoveredMediaResolution(raw, source, options = {}) {
        const fail = reason => ({ok:false, reason});
        const root = raw?.media && typeof raw.media === 'object'
            ? raw.media : raw;
        if (!root || typeof root !== 'object') return fail('missing_root');
        const children = Array.isArray(root.carousel_media) &&
            root.carousel_media.length
                ? root.carousel_media
                : (root?.edge_sidecar_to_children?.edges || [])
                    .map(e => e?.node).filter(Boolean);
        const units = children.length ? children : [root];
        const product = String(
            root.product_type || root.media_product_type || ''
        ).toLowerCase();
        const isCarousel = Number(root.media_type) === 8 ||
            root.__typename === 'GraphSidecar' ||
            ['carousel_container', 'carousel'].includes(product);
        const rawClaim = root.carousel_media_count;
        const claimedCount = rawClaim == null || rawClaim === ''
            ? 0 : Number(rawClaim);

        if (rawClaim != null && rawClaim !== '' &&
            (!Number.isSafeInteger(claimedCount) || claimedCount < 0)) {
            return fail('invalid_carousel_item_count');
        }
        if (root?.edge_sidecar_to_children?.page_info?.has_next_page === true) {
            return fail('sidecar_pagination_unfinished');
        }
        if (isCarousel && children.length < 2) {
            return fail('carousel_children_unavailable');
        }
        if (Number.isSafeInteger(claimedCount) && claimedCount > units.length &&
            !(source === 'TAGGED' &&
              options?.verifiedAccessibleCarousel === true && isCarousel)) {
            return fail('carousel_item_count_gap');
        }
        const rootId = normalizePk(root);
        if (!rootId) return fail('missing_root_identity');

        const observed = new Set();
        for (const unit of units) {
            const id = normalizePk(unit);
            if (!id || observed.has(id)) {
                return fail('missing_or_duplicate_unit_identity');
            }
            observed.add(id);
            const stored = state.queue.get(String(id));
            if (
                !stored ||
                !stored.filename ||
                !(stored.sources instanceof Set) ||
                !stored.sources.has(String(source)) ||
                !(stored.rootIds instanceof Set) ||
                !stored.rootIds.has(String(rootId)) ||
                (!stored.url && !stored.diskBacked)
            ) {
                return fail('unresolved_media_unit');
            }
        }
        return {ok:true, reason:'all_discovered_units_archived'};
    }

    async function scanTaggedGraphQL() {
        state.coverage.tagged = false;
        state.taggedCountHintMismatches = [];
        state.taggedCountHintFailures = [];
        state.taggedHistoricalPostRestored = 0;
        state.taggedExplicitChildProbes = [];
        let explicitChildInfoRequests = 0;

        const initialDoc =
            net.taggedDocInitial ||
            APP.TAGGED_FALLBACK_DOC;

        const nativeVariables = (() => {
            const v =
                net.taggedNativeVariables &&
                typeof net.taggedNativeVariables === 'object'
                    ? JSON.parse(
                        JSON.stringify(
                            net.taggedNativeVariables
                        )
                    )
                    : {
                        count: 12,
                        user_id: state.userId,
                        __relay_internal__pv__PolarisShortDramaEnabledrelayprovider: false,
                    };

            v.count =
                Number(v.count || 12);

            v.user_id =
                String(state.userId);

            if (
                !Object.prototype.hasOwnProperty.call(
                    v,
                    '__relay_internal__pv__PolarisShortDramaEnabledrelayprovider'
                )
            ) {
                v.__relay_internal__pv__PolarisShortDramaEnabledrelayprovider =
                    false;
            }

            return v;
        })();

        let cursor = '';
        let pages = 0;
        let totalRoots = 0;
        let unresolvedRoots = 0;
        let resolvedRoots = 0;
        const unresolvedReasons = new Map();
        let hydrationAttempts = 0;
        let hydratedRoots = 0;
        let verifiedCountHintMismatches = 0;
        let endReason = 'max_pages';
        const seenCursors = new Set();

        const nativeInitial =
            net.taggedInitialData &&
            String(net.taggedInitialUserId || '') ===
                String(state.userId || '')
                ? net.taggedInitialData
                : null;

        log(
            `Scanning TAGGED GraphQL first (doc=${initialDoc}` +
            `${net.taggedDocInitial ? ', native-captured' : ', fallback'}, ` +
            `first_page=${nativeInitial ? 'native-cache' : 'request'}).`
        );

        for (
            let page = 1;
            page <= APP.TAGGED_MAX_PAGES;
            page++
        ) {
            if (state.cancelled) {
                throw new Error('Cancelled');
            }

            let d;

            if (
                page === 1 &&
                nativeInitial
            ) {
                d =
                    nativeInitial;
            }
            else {
                const pagination =
                    page > 1;

                const doc =
                    pagination
                        ? (
                            net.taggedDocConnection ||
                            initialDoc
                        )
                        : initialDoc;

                const friendly =
                    pagination &&
                    net.taggedDocConnection
                        ? 'PolarisProfileTaggedTabContentQuery_connection'
                        : 'PolarisProfileTaggedTabContentQuery';

                const variables =
                    {
                        ...nativeVariables,
                    };

                if (pagination) {
                    variables.after =
                        cursor;
                    variables.first =
                        Number(
                            variables.first ||
                            variables.count ||
                            12
                        );
                    variables.before =
                        null;
                    variables.last =
                        null;
                }

                try {
                    d = await gql(
                        doc,
                        variables,
                        friendly
                    );
                }
                catch (e) {
                    throwIfInstagramStop(
                        e,
                        'TAGGED GraphQL'
                    );

                    log(
                        `TAGGED GraphQL page ${page} failed: ${e.message}.`,
                        'warn'
                    );

                    return false;
                }
            }

            const conn =
                taggedConn(d);

            if (Array.isArray(d?.errors) && d.errors.length) {
                log('TAGGED GraphQL page ' + page +
                    ': server returned GraphQL errors; refusing partial success.',
                    'warn');
                return false;
            }

            if (!conn) {
                log(
                    `TAGGED GraphQL page ${page}: tagged connection missing.`,
                    'warn'
                );
                return false;
            }

            const edges =
                conn.edges ||
                [];

            pages++;
            totalRoots +=
                edges.length;

            for (const e of edges) {
                const media = edgeNode(e);
                const rootId = normalizePk(media);
                if (rootId) state.roots.TAGGED.add(rootId);
                addMedia(media, 'TAGGED', 'TAGGED');
                const historicalRestored = restoreHistoricalTaggedPostArchive(media);
                if (historicalRestored) {
                    state.taggedHistoricalPostRestored += historicalRestored;
                    log(
                        'TAGGED historical archive category preserved: root=' +
                        rootId + ', files=' + historicalRestored +
                        ' (previous native PROFILE POST evidence only; ' +
                        'current PROFILE coverage unchanged).'
                    );
                }
                let proof = discoveredMediaResolution(media, 'TAGGED');
                let recovery = 'not_needed';

                // TAGGED is a discovery list, not guaranteed full media-info.
                // Resolve missing file units through the SAME media-info GET
                // already used for owned-root hydration. At most one
                // same-origin request per eligible root; no mobile clips probe,
                // alternate host, retry storm or guessed GraphQL document.
                const eligible = !proof.ok && /^\d+$/.test(rootId) &&
                    [
                        'unresolved_media_unit',
                        'carousel_children_unavailable',
                        'carousel_item_count_gap',
                    ].includes(proof.reason);
                if (eligible && hydrationAttempts < APP.TAGGED_HYDRATION_LIMIT) {
                    hydrationAttempts++;
                    recovery = 'web_media_info_attempted';
                    try {
                        const detailed = await fetchOwnedMediaInfo(
                            rootId,
                            'TAGGED media-info',
                            {singleWebOnly: true}
                        );
                        if (normalizePk(detailed) !== rootId) {
                            proof = {ok:false, reason:'media_info_identity_mismatch'};
                        } else {
                            addMedia(detailed, 'TAGGED', 'TAGGED');
                            state.taggedHistoricalPostRestored +=
                                restoreHistoricalTaggedPostArchive(detailed);
                            const countHintProof =
                                taggedAccessibleCarouselProof(media, detailed);
                            const detailedProof = discoveredMediaResolution(
                                detailed, 'TAGGED',
                                {verifiedAccessibleCarousel: countHintProof.ok}
                            );
                            if (!countHintProof.ok &&
                                Number(media?.carousel_media_count || 0) > 1 &&
                                proof.reason === 'carousel_item_count_gap') {
                                const childrenOf = x =>
                                    Array.isArray(x?.carousel_media) &&
                                    x.carousel_media.length
                                        ? x.carousel_media
                                        : (x?.edge_sidecar_to_children?.edges || [])
                                            .map(e => e?.node).filter(Boolean);
                                const left = childrenOf(media);
                                const right = childrenOf(detailed);
                                const leftIds = left.map(normalizePk);
                                const rightIds = right.map(normalizePk);
                                const sameSet = leftIds.length === rightIds.length &&
                                    new Set(leftIds).size === leftIds.length &&
                                    new Set(rightIds).size === rightIds.length &&
                                    leftIds.every(id => rightIds.includes(id));
                                const mismatch = {
                                    rootId,
                                    reason: countHintProof.reason,
                                    claimed: Number(media.carousel_media_count),
                                    detailClaim:
                                        detailed.carousel_media_count == null
                                            ? null : Number(detailed.carousel_media_count),
                                    listChildren: left.length,
                                    detailChildren: right.length,
                                    sameChildIds: sameSet,
                                    sameChildOrder: leftIds.length === rightIds.length &&
                                        leftIds.every((id,i) => id === rightIds[i]),
                                    listMediaType: Number(media?.media_type || 0),
                                    infoMediaType: Number(detailed?.media_type || 0),
                                    listOwnerPresent: !!normalizePk(media?.user),
                                    infoOwnerPresent: !!normalizePk(detailed?.user),
                                    ownerMatch: !!normalizePk(media?.user) &&
                                        normalizePk(media?.user) ===
                                            normalizePk(detailed?.user),
                                    sameShortcode: !!String(media?.code ||
                                        media?.shortcode || '') &&
                                        String(media?.code || media?.shortcode) ===
                                            String(detailed?.code ||
                                                detailed?.shortcode || ''),
                                    listIndependentIds:
                                        Array.isArray(media?.carousel_media_ids)
                                            ? media.carousel_media_ids.length : null,
                                    detailIndependentIds:
                                        Array.isArray(detailed?.carousel_media_ids)
                                            ? detailed.carousel_media_ids.length : null,
                                    listSidecarNext:
                                        media?.edge_sidecar_to_children?.page_info
                                            ?.has_next_page === true,
                                    detailSidecarNext:
                                        detailed?.edge_sidecar_to_children?.page_info
                                            ?.has_next_page === true,
                                    listPending:
                                        Number(media?.carousel_media_pending_post_count || 0),
                                    detailPending:
                                        Number(detailed?.carousel_media_pending_post_count || 0),
                                };
                                state.taggedCountHintFailures.push(mismatch);
                                log(
                                    'TAGGED count hint proof rejected: root=' +
                                    rootId + ', reason=' + mismatch.reason +
                                    ', list=' + mismatch.listChildren +
                                    ', info=' + mismatch.detailChildren +
                                    ', same_ids=' + mismatch.sameChildIds +
                                    ', same_order=' + mismatch.sameChildOrder +
                                    ', claims=' + mismatch.claimed +
                                    '/' + (mismatch.detailClaim ?? '-') +
                                    ', owner_match=' + mismatch.ownerMatch +
                                    ', code_match=' + mismatch.sameShortcode +
                                    ', types=' + mismatch.listMediaType +
                                    '/' + mismatch.infoMediaType +
                                    ', id_lists=' + (mismatch.listIndependentIds ?? '-') +
                                    '/' + (mismatch.detailIndependentIds ?? '-') +
                                    ', pending=' + mismatch.listPending +
                                    '/' + mismatch.detailPending + '.',
                                    'warn'
                                );
                            }
                            // A matching full authenticated child-ID inventory
                            // is proof only of CURRENTLY ACCESSIBLE media. A
                            // larger numeric hint must stay visible in logs;
                            // independent contradictory IDs must fail closed.
                            // A FOURTH numeric ID exists in the authenticated
                            // parent inventory, not in the three media objects.
                            // Make at most two additional same-origin GETs per
                            // TAGGED scan, each with an exact server-returned ID.
                            // No alternate host, retries or speculative ID.
                            let explicitChildProof = null;
                            if (!countHintProof.ok &&
                                countHintProof.reason ===
                                    'independent_child_ids_conflict' &&
                                proof.reason === 'carousel_item_count_gap') {
                                const candidate =
                                    taggedExplicitMissingChildCandidate(
                                        media, detailed
                                    );
                                if (candidate.ok) {
                                    const audit = {
                                        parent: rootId,
                                        childId: candidate.childId,
                                        declared: candidate.declared,
                                        alreadyMaterialized: candidate.known,
                                        status: explicitChildInfoRequests >= 2
                                            ? 'bounded_probe_limit' : 'attempted',
                                    };
                                    if (explicitChildInfoRequests < 2) {
                                        explicitChildInfoRequests++;
                                        try {
                                            const child = await fetchOwnedMediaInfo(
                                                candidate.childId,
                                                'TAGGED enumerated carousel child',
                                                {singleWebOnly:true}
                                            );
                                            const validation =
                                                taggedValidateExplicitChild(
                                                    detailed,candidate.childId,child
                                                );
                                            if (validation.ok) {
                                                const children = Array.isArray(
                                                    detailed.carousel_media
                                                ) && detailed.carousel_media.length
                                                    ? detailed.carousel_media
                                                    : (detailed
                                                        ?.edge_sidecar_to_children
                                                        ?.edges || [])
                                                        .map(e => e?.node)
                                                        .filter(Boolean);
                                                const verifiedRoot = {
                                                    ...detailed,
                                                    carousel_media: [
                                                        ...children,child
                                                    ],
                                                };
                                                // Parent's explicit 4 IDs and
                                                // child's authenticated media info
                                                // are both required; never reduce
                                                // carousel_media_count to three.
                                                addMedia(
                                                    verifiedRoot,'TAGGED','TAGGED'
                                                );
                                                state.taggedHistoricalPostRestored +=
                                                    restoreHistoricalTaggedPostArchive(
                                                        verifiedRoot
                                                    );
                                                explicitChildProof =
                                                    discoveredMediaResolution(
                                                        verifiedRoot,'TAGGED'
                                                    );
                                                audit.status = explicitChildProof.ok
                                                    ? 'resolved_all_declared_children'
                                                    : explicitChildProof.reason;
                                            } else {
                                                audit.status = validation.reason;
                                            }
                                        } catch (e) {
                                            throwIfInstagramStop(
                                                e,
                                                'TAGGED enumerated carousel child'
                                            );
                                            audit.status =
                                                'child_media_info_unavailable';
                                            audit.httpStatus =
                                                Number(e?.status || 0) || null;
                                        }
                                    }
                                    state.taggedExplicitChildProbes.push(audit);
                                    log(
                                        'TAGGED explicit fourth child: root=' +
                                        rootId + ', server_id=' +
                                        candidate.childId + ', status=' +
                                        audit.status +
                                        (audit.httpStatus
                                            ? ', http=' + audit.httpStatus : '') +
                                        ', no_assumed_child.',
                                        explicitChildProof?.ok
                                            ? 'info' : 'warn'
                                    );
                                } else {
                                    log(
                                        'TAGGED explicit child recovery not safe: ' +
                                        'root=' + rootId +
                                        ', reason=' + candidate.reason + '.',
                                        'warn'
                                    );
                                }
                            }
                            const rawCount = Number(media?.carousel_media_count || 0);
                            const fullChildren = Array.isArray(detailed?.carousel_media)
                                ? detailed.carousel_media.length
                                : Array.isArray(detailed?.edge_sidecar_to_children?.edges)
                                    ? detailed.edge_sidecar_to_children.edges.length
                                    : 0;
                            if (explicitChildProof?.ok) {
                                proof = explicitChildProof;
                                hydratedRoots++;
                                recovery = 'web_explicit_child_resolved';
                            } else if (detailedProof.ok && Number.isSafeInteger(rawCount) &&
                                rawCount > 1 && fullChildren < rawCount &&
                                !countHintProof.ok) {
                                proof = {ok:false, reason:'hydrated_carousel_count_gap'};
                            } else {
                                proof = detailedProof;
                                if (proof.ok) {
                                    hydratedRoots++;
                                    recovery = 'web_media_info_resolved';
                                    if (countHintProof.ok) {
                                        verifiedCountHintMismatches++;
                                        state.taggedCountHintMismatches.push({
                                            rootId,
                                            shortcode: String(media?.code ||
                                                media?.shortcode || ''),
                                            declared: countHintProof.declared,
                                            accessible: countHintProof.accessible,
                                            sameAuthenticatedChildren: true,
                                            sameOrder: countHintProof.sameOrder,
                                            historicalCompletenessUnknown: true,
                                        });
                                        log(
                                            'TAGGED accessible carousel count hint mismatch: root=' +
                                            rootId + ', declared=' + countHintProof.declared +
                                            ', list=info_same_children=' +
                                            countHintProof.accessible +
                                            ', status=accessible_units_verified_only. ' +
                                            'The historical declared count is NOT explained; ' +
                                            'no fourth media ID was inferred.',
                                            'warn'
                                        );
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        throwIfInstagramStop(err, 'TAGGED media-info');
                        proof = {ok:false, reason:'web_media_info_unavailable'};
                    }
                } else if (eligible) {
                    recovery = 'hydration_limit_reached';
                }

                if (proof.ok) {
                    resolvedRoots++;
                } else {
                    unresolvedRoots++;
                    unresolvedReasons.set(
                        proof.reason,
                        (unresolvedReasons.get(proof.reason) || 0) + 1
                    );
                    // Field-presence diagnostics only: no media URLs, cookies,
                    // response dumps or personal payloads in the scan logs.
                    const video = Number(media?.media_type) === 2 ||
                        media?.is_video === true || media?.__typename === 'GraphVideo';
                    log(
                        'TAGGED unresolved media: kind=' +
                        (Number(media?.media_type) || media?.__typename || '?') +
                        ', image=' + !!(media?.display_uri || media?.display_url ||
                            media?.image_versions2?.candidates?.length) +
                        ', video=' + !!(media?.video_url ||
                            media?.video_versions?.length) +
                        ', video_kind=' + video +
                        ', recovery=' + recovery +
                        ', reason=' + proof.reason + '.',
                        'warn'
                    );
                }
            }

            updateStats();

            const pi =
                conn.page_info ||
                {};

            const hasNext =
                pi.has_next_page === true;

            const next =
                String(
                    pi.end_cursor ||
                    ''
                );

            log(
                `TAGGED GraphQL page ${page}: edges=${edges.length}, ` +
                `has_next=${hasNext}, cursor=${next ? 'yes' : 'none'}, ` +
                `source=${page === 1 && nativeInitial ? 'native-cache' : 'graphql'}.`
            );

            if (!hasNext) {
                state.coverage.tagged =
                    unresolvedRoots === 0 && pi.has_next_page === false;
                endReason = state.coverage.tagged
                    ? 'page_info_end_all_media_resolved'
                    : 'page_info_end_media_unresolved';
                break;
            }

            if (!next) {
                endReason = 'missing_cursor';
                break;
            }

            if (seenCursors.has(next)) {
                endReason = 'repeated_cursor';
                log(
                    `TAGGED GraphQL cursor repeated on page ${page}; stopping.`,
                    'warn'
                );
                break;
            }

            seenCursors.add(next);
            cursor = next;

            await sleep(
                rand(
                    APP.PAGE_MIN,
                    APP.PAGE_MAX
                )
            );
        }

        if (
            !state.coverage.tagged &&
            pages >= APP.TAGGED_MAX_PAGES
        ) {
            endReason = 'max_pages';
        }

        updateStats();

        log(
            `TAGGED GraphQL complete: pages=${pages}, roots=${totalRoots}, ` +
            `resolved=${resolvedRoots}, unresolved=${unresolvedRoots}, ` +
            `hydration=${hydratedRoots}/${hydrationAttempts}, ` +
            `count_hint_mismatches=${verifiedCountHintMismatches}, ` +
            `count_hint_rejected=${state.taggedCountHintFailures.length}, ` +
            `explicit_child_probes=${state.taggedExplicitChildProbes.length}, ` +
            `explicit_child_resolved=${state.taggedExplicitChildProbes.filter(
                x => x.status === 'resolved_all_declared_children').length}, ` +
            `historical_post_paths=${state.taggedHistoricalPostRestored}, ` +
            `end=${endReason}, ended=${state.coverage.tagged}, ` +
            `reasons=${[...unresolvedReasons].map(([key, count]) =>
                key + ':' + count).join(',') || '-'}. ` +
            (unresolvedRoots
                ? 'Returned tagged roots lack archived media units; ' +
                  'not treating pagination end as download completeness.'
                : '')
        );

        return state.coverage.tagged;
    }

    async function scanTagged() {
        log(
            'Scanning TAGGED via native Web GraphQL…'
        );
        status(
            'Scanning TAGGED…'
        );

        state.coverage.tagged =
            false;

        const ok =
            await scanTaggedGraphQL();

        if (!ok) {
            log(
                'TAGGED native GraphQL did not prove completeness; no REST fallback will be attempted.',
                'warn'
            );
        }

        return ok;
    }

    function hiId(v) {
        const s =
            String(v || '');

        return s.startsWith(
            'highlight:'
        )
            ? s.slice(10)
            : s;
    }

    function storyReelsFromPayload(data) {
        const root =
            storyReelRoot(data);

        if (!root) {
            return null;
        }

        const reels =
            root.reels_media;

        return Array.isArray(reels)
            ? reels
            : null;
    }

    async function fetchWebStoryReel(
        reelId,
        isHighlight = false,
        label = 'STORY'
    ) {
        const doc =
            net.storyReelDoc ||
            APP.STORY_REEL_FALLBACK_DOC;

        const variables = {
            reel_ids_arr: [
                String(reelId),
            ],
            __relay_internal__pv__PolarisCommunityNoteStoriesLabelEnabledrelayprovider:
                true,
        };

        if (isHighlight) {
            variables.is_highlight =
                true;
        }

        const d =
            await webRelayGql(
                doc,
                variables,
                'PolarisStoriesV3ReelPageStandaloneQuery',
                {
                    endpoint: 'query',
                    rootField:
                        STORY_REEL_ROOT_KEY,
                }
            );

        const reels =
            storyReelsFromPayload(
                d
            );

        if (!reels) {
            throw new Error(
                `${label}: Web GraphQL reels_media root missing.`
            );
        }

        return reels;
    }

    async function scanStory() {
        log(
            'Scanning STORY via native Web GraphQL…'
        );
        status(
            'Scanning STORY…'
        );

        state.coverage.story =
            false;

        let reels;

        try {
            reels =
                await fetchWebStoryReel(
                    state.userId,
                    false,
                    'STORY'
                );
        }
        catch (e) {
            throwIfInstagramStop(
                e,
                'STORY Web GraphQL'
            );

            log(
                `STORY unavailable: ${e.message}`,
                'warn'
            );

            updateStats();
            return false;
        }

        const target =
            reels.find(
                reel =>
                    hiId(reel?.id) === String(state.userId)
            ) || null;

        if (reels.length && !target) {
            log('STORY: no reel matched the verified profile ID.', 'warn');
            updateStats();
            return false;
        }

        const items =
            target == null
                ? []
                : target?.items;

        if (
            target != null &&
            !Array.isArray(items)
        ) {
            log(
                'STORY Web GraphQL returned a reel without an items array.',
                'warn'
            );

            updateStats();
            return false;
        }

        let unresolvedItems = 0;
        for (const x of (Array.isArray(items) ? items : [])) {
            addMedia(x, 'STORY', 'STORY_WEB_GRAPHQL');
            if (!discoveredMediaResolution(x, 'STORY_WEB_GRAPHQL').ok) {
                unresolvedItems++;
            }
        }

        // A server-complete STORY response with an undownloadable item
        // is an incomplete archive, not an empty/successful collection.
        state.coverage.story = unresolvedItems === 0;

        updateStats();

        log(
            `STORY Web GraphQL: ${Array.isArray(items) ? items.length : 0} current items, ` +
            `unresolved=${unresolvedItems}, reels=${reels.length}, ` +
            `ended=${state.coverage.story}.`
        );

        return state.coverage.story;
    }

    async function getHighlightTrayWeb() {
        const cached =
            net.highlightTrayData &&
            String(
                net.highlightTrayUserId ||
                ''
            ) ===
                String(
                    state.userId ||
                    ''
                )
                ? net.highlightTrayData
                : null;

        if (cached) {
            return {
                data: cached,
                source: 'native-cache',
            };
        }

        const doc =
            net.highlightTrayDoc ||
            APP.HIGHLIGHT_TRAY_FALLBACK_DOC;

        const variables =
            net.highlightTrayVariables &&
            typeof net.highlightTrayVariables ===
                'object'
                ? JSON.parse(
                    JSON.stringify(
                        net.highlightTrayVariables
                    )
                )
                : {
                    user_id:
                        String(
                            state.userId
                        ),
                };

        variables.user_id =
            String(
                state.userId
            );

        const endpoint =
            net.highlightTrayEndpoint === 'query'
                ? 'query'
                : 'api';

        const friendly =
            net.highlightTrayFriendly ||
            'PolarisProfileStoryHighlightsTrayContentQuery';

        const d =
            await webRelayGql(
                doc,
                variables,
                friendly,
                {
                    endpoint,
                    rootField:
                        endpoint === 'query'
                            ? HIGHLIGHT_TRAY_CONNECTION_KEY
                            : '',
                }
            );

        return {
            data: d,
            source: 'graphql',
        };
    }

    async function scanHighlights() {
        log(
            'Scanning HIGHLIGHT tray via native Web GraphQL…'
        );
        status(
            'Scanning HIGHLIGHT…'
        );

        state.coverage.highlights =
            false;

        let trayResult;

        try {
            trayResult =
                await getHighlightTrayWeb();
        }
        catch (e) {
            throwIfInstagramStop(
                e,
                'HIGHLIGHT tray Web GraphQL'
            );

            log(
                `HIGHLIGHT tray unavailable: ${e.message}`,
                'warn'
            );

            updateStats();
            return false;
        }

        const conn =
            highlightTrayConn(
                trayResult.data
            );

        if (!conn) {
            log(
                'HIGHLIGHT tray Web GraphQL connection missing.',
                'warn'
            );

            updateStats();
            return false;
        }

        const edges =
            Array.isArray(conn.edges)
                ? conn.edges
                : [];

        const pageInfo =
            conn.page_info ||
            {};

        const trayEnded =
            pageInfo.has_next_page ===
            false;

        if (
            pageInfo.has_next_page ===
            true
        ) {
            log(
                'HIGHLIGHT tray reports has_next_page=true. ' +
                'The current next-page operation is not live-validated; refusing guessed pagination.',
                'warn'
            );
        }
        else if (
            pageInfo.has_next_page !==
            false
        ) {
            log(
                'HIGHLIGHT tray has no explicit has_next_page terminator.',
                'warn'
            );
        }

        const tray =
            edges
                .map(
                    edge =>
                        edgeNode(edge)
                )
                .filter(Boolean);

        state.highlightCatalog = buildHighlightCatalog(tray);

        log(
            `HIGHLIGHT tray: ${tray.length} reels, ` +
            `source=${trayResult.source}, ` +
            `has_next_page=${pageInfo.has_next_page}.`
        );

        setScanProgressPhase(
            'HIGHLIGHTS',
            0,
            tray.length,
            tray.length
                ? 'reading reels'
                : 'empty tray'
        );

        let allOk =
            trayEnded && state.highlightCatalog.size === tray.length;

        if (state.highlightCatalog.size !== tray.length) {
            log('HIGHLIGHT tray contains duplicate or invalid reel IDs; ' +
                'coverage remains INCOMPLETE.', 'warn');
        }

        for (
            let index = 0;
            index < tray.length;
            index++
        ) {
            setScanProgressPhase(
                'HIGHLIGHTS',
                index,
                tray.length,
                'reading reels'
            );

            if (state.cancelled) {
                throw new Error(
                    'Cancelled'
                );
            }

            const h =
                tray[index];

            const title =
                String(
                    h?.title ||
                    `Highlight ${index + 1}`
                );

            const id =
                hiId(
                    h?.id ||
                    h?.pk ||
                    h?.reel_id
                );

            if (!id) {
                allOk = false;

                log(
                    `HIGHLIGHT “${title}” has no resolvable reel ID.`,
                    'warn'
                );

                continue;
            }

            const expected =
                `highlight:${id}`;

            let reels;

            try {
                reels =
                    await fetchWebStoryReel(
                        expected,
                        true,
                        `HIGHLIGHT “${title}”`
                    );
            }
            catch (e) {
                throwIfInstagramStop(
                    e,
                    `HIGHLIGHT “${title}” Web GraphQL`
                );

                allOk = false;

                log(
                    `HIGHLIGHT “${title}” unavailable: ${e.message}`,
                    'warn'
                );

                continue;
            }

            const reel =
                reels.find(
                    candidate => hiId(candidate?.id) === id
                ) || null;

            const items =
                reel?.items;

            if (
                !reel ||
                !Array.isArray(items)
            ) {
                allOk = false;

                log(
                    `HIGHLIGHT “${title}” Web GraphQL did not return a complete reel.`,
                    'warn'
                );

                continue;
            }

            let unresolvedItems = 0;
            for (const x of items) {
                const source = `HIGHLIGHT_REEL:${id}`;
                addMedia(x, 'HIGHLIGHT', source, { highlightId: id });
                if (!discoveredMediaResolution(x, source).ok) {
                    unresolvedItems++;
                    allOk = false;
                }
            }
            if (unresolvedItems) {
                log(
                    `HIGHLIGHT “${title}” [${id}]: ${unresolvedItems}/${items.length} ` +
                    'returned items have unresolved media units. ' +
                    'Highlight coverage remains INCOMPLETE.',
                    'warn'
                );
            }

            setScanProgressPhase(
                'HIGHLIGHTS',
                index + 1,
                tray.length,
                'reading reels'
            );

            updateStats();

            status(
                `Scanning HIGHLIGHT ${index + 1}/${tray.length}…`
            );

            log(
                `HIGHLIGHT “${title}” [${id}]: ${items.length} items via Web GraphQL; ` +
                `folder="${state.highlightCatalog.get(id)?.folder || 'UNVERIFIED'}".`
            );

            if (
                index + 1 <
                tray.length
            ) {
                await sleep(
                    rand(
                        APP.PAGE_MIN,
                        APP.PAGE_MAX
                    )
                );
            }
        }

        state.coverage.highlights =
            allOk;

        if (allOk) {
            reconcileHighlightTitleHistory();
            reportHighlightFolderRenames();
        }

        updateStats();

        log(
            `HIGHLIGHT Web GraphQL scan ended=${state.coverage.highlights}, ` +
            `tray_ended=${trayEnded}, reels=${tray.length}.`
        );

        return state.coverage.highlights;
    }

    function hash(s) {
        let h =
            2166136261;

        for (
            let i = 0;
            i < s.length;
            i++
        ) {
            h ^=
                s.charCodeAt(i);

            h =
                Math.imul(
                    h,
                    16777619
                );
        }

        return (
            h >>> 0
        )
            .toString(16)
            .padStart(8, '0');
    }

    async function scanAvatar() {
        log(
            'Scanning AVATAR…'
        );

        let p =
            state.profile ||
            {};

        let url =
            p?.profile_pic_url_hd ||
            p?.profile_pic_url ||
            '';

        /*
         * refreshProfileInfo() already fetched /users/<id>/info/ a few
         * seconds earlier in the same scan. Reuse that fresh payload first;
         * only hit the endpoint again if it did not expose any avatar URL.
         */
        p =
            state.profileInfo ||
            p;

        url =
            p?.hd_profile_pic_url_info?.url ||
            p?.hd_profile_pic_versions?.[0]?.url ||
            p?.profile_pic_url_hd ||
            p?.profile_pic_url ||
            url;

        if (!url) {
            try {
                const d =
                    await fetchJson(
                        `https://www.instagram.com/api/v1/users/${state.userId}/info/`,
                        {},
                        'AVATAR',
                        1
                    );

                p =
                    d?.user ||
                    p;

                url =
                    p?.hd_profile_pic_url_info?.url ||
                    p?.hd_profile_pic_versions?.[0]?.url ||
                    p?.profile_pic_url_hd ||
                    p?.profile_pic_url ||
                    url;
            }

            catch (e) {
                throwIfInstagramStop(e, 'AVATAR: Instagram returned feedback_required.');
            }
        }

        if (!url) {
            state.coverage.avatar = false;

            log(
                'AVATAR URL not found',
                'warn'
            );

            return false;
        }

        const id =
            `${state.userId}_` +
            `${hash(
                url.split('?')[0]
            )}`;

        const m = {
            id,
            type: 'AVATAR',
            timestamp:
                Date.now() / 1000,
            ext: 'jpg',
            url,
            shortcode: '',
            rootCount: 1,
            originalToken:
                originalToken(url),
            sources:
                new Set([
                    'AVATAR',
                ]),
        };

        m.filename =
            filename(m);

        state.queue.set(
            id,
            m
        );

        state.roots.AVATAR
            .add(id);

        state.coverage.avatar = true;

        updateStats();
        return true;
    }

    function scanProfilerSnapshot() {
        return {
            queue: state.queue.size,
            owned: ownedCount(),
            post: state.roots.POST.size,
            reel: state.roots.REEL.size,
            tagged: state.roots.TAGGED.size,
            highlight: state.roots.HIGHLIGHT.size,
            story: state.roots.STORY.size,
            avatar: state.roots.AVATAR.size,
            publicExtras: state.shadow.extras,
            hiddenCandidates: state.hidden.candidates,
            hiddenRecovered: state.hidden.recovered,
            hydrated: state.hydration.hydratedRoots,
            hydrateDisk: state.hydration.diskSatisfiedRoots,
            hydrateTotal: state.hydration.totalRoots,
            hydrateFailed: state.hydration.failedRoots,
        };
    }

    function scanProfilerFingerprint(values) {
        return hash(
            [...values]
                .map(String)
                .sort()
                .join('|')
        );
    }

    function scanProfilerInventory() {
        return {
            ownedRoots: scanProfilerFingerprint(ownedIds()),
            allRoots: scanProfilerFingerprint([
                ...state.roots.POST,
                ...state.roots.REEL,
                ...state.roots.TAGGED,
                ...state.roots.HIGHLIGHT,
                ...state.roots.STORY,
                ...state.roots.AVATAR,
            ]),
            queuedMedia: scanProfilerFingerprint(state.queue.keys()),
        };
    }


    function scanDownloadFingerprint() {
        return [...state.queue.values()]
            .map(m => [
                String(m.id || ''),
                String(m.type || ''),
                String(m.filename || ''),
                String(m.url || ''),
                String(m.visibility || ''),
                mediaArchiveCategory(m),
                hiddenDiscoverySources(m)
                    .sort()
                    .join(','),
                m.sources instanceof Set
                    ? [...m.sources].map(String).sort().join(',')
                    : '',
                m.rootIds instanceof Set
                    ? [...m.rootIds].map(String).sort().join(',')
                    : '',
                String(m.highlightId || ''),
                m.highlightIds instanceof Set
                    ? [...m.highlightIds].map(String).sort().join(',')
                    : '',
                m.type === 'HIGHLIGHT'
                    ? archiveDownloadPath(m)
                    : '',
            ].join('|'))
            .sort()
            .join('\n');
    }


    // Each returned unit must belong to a root proven downloadable by the
    // authenticated media-info endpoint. Public-only roots never qualify.
    function verifiedSubscriberMedia() {
        const verifiedRoots = state.verifiedSubscriberRootIds;
        return [...state.queue.values()].filter(m =>
            !!m?.url &&
            ['POST', 'REEL'].includes(m.type) &&
            m.sources instanceof Set &&
            m.sources.has('CONNECTED_HIDDEN_AUTHORIZED') &&
            m.rootIds instanceof Set &&
            [...m.rootIds].some(id => verifiedRoots.has(String(id)))
        );
    }

    // Only independently proven, accessible surfaces are included.
    // REELS, TAGGED, subscriber media and unverified PROFILE-only items
    // never enter this bounded partial download.
    function reconcilePassiveProfilePostRoots() {
        // A partial native PROFILE timeline can contain individually
        // complete, genuinely browser-observed POST carousels even while
        // has_next_page remains true. This is permission to save those
        // individual fully backed units, never proof of grid completion.
        const verified = state.verifiedPassiveProfilePostRootIds;
        if (!(verified instanceof Set)) return;
        verified.clear();

        if (!scanSelected('post') ||
            state.coverage.ownedHydration !== true ||
            state.cancelled || state.feedbackRequired ||
            state.rateLimited || state.apiUnhealthy) return;

        const key = String(state.username || '').toLowerCase();
        const uid = String(state.userId || '');
        const apiId = String(
            state.profileInfo?.pk || state.profileInfo?.id || ''
        ).split('_')[0];
        const session = state.nativeProfileEvidenceSession;
        const capturedAt = net.gridCaptureSeenAtByUser?.get?.(key);
        const audit = net.gridNativeAuditByUser?.get?.(key);
        const roots = net.gridByUser?.get?.(key);

        // The observer only stores server-successful responses from a
        // PROFILE request explicitly targeted to this account. Revalidate
        // the account and the current scan's accepted capture window.
        const currentCapture = !!session &&
            session.key === key && session.userId === uid &&
            Number.isFinite(session.acceptedAt) &&
            Number.isFinite(capturedAt) &&
            (capturedAt === session.acceptedCapturedAt ||
                capturedAt >= session.acceptedAt);
        if (!uid || apiId !== uid || !currentCapture ||
            !(roots instanceof Map) ||
            !audit || (audit.initial || 0) + (audit.continuation || 0) < 1) {
            return;
        }

        for (const [keyId, raw] of roots) {
            const id = normalizePk(raw);
            if (!/^\d+$/.test(id) || String(keyId) !== id ||
                !state.roots.POST.has(id)) continue;

            const rec = state.rootCatalog.get(id);
            if (!rec || rec.type !== 'POST' ||
                !(rec.sources instanceof Set) ||
                !rec.sources.has('PROFILE_GRID_NATIVE') ||
                rec.structureComplete !== true ||
                rec.forceHydrate === true ||
                !Number.isSafeInteger(rec.expectedUnits) ||
                rec.expectedUnits < 1) continue;

            // Do not accept a native preview of only a few carousel
            // children just because a later media-info call populated
            // more units. Every child must be directly proven in the
            // captured native root and the same archive inventory.
            const sidecar = Array.isArray(raw?.carousel_media) &&
                raw.carousel_media.length
                    ? raw.carousel_media
                    : (raw?.edge_sidecar_to_children?.edges || [])
                        .map(e => e?.node).filter(Boolean);
            const nativeUnits = sidecar.length || 1;
            if (nativeUnits !== rec.expectedUnits ||
                queuedUnitsForRoot(id) !== rec.expectedUnits) continue;

            if (discoveredMediaResolution(raw, 'PROFILE_GRID_NATIVE').ok) {
                verified.add(id);
            }
        }

        if (verified.size) {
            const items = [...state.queue.values()].filter(m =>
                m?.type === 'POST' &&
                m?.sources instanceof Set &&
                m.sources.has('PROFILE_GRID_NATIVE') &&
                m?.rootIds instanceof Set &&
                [...m.rootIds].some(id => verified.has(String(id)))
            ).length;
            log('PROFILE individually verified native POST roots=' +
                verified.size + ', media=' + items +
                '. Partial-access proof only; PROFILE pagination ' +
                'remains independently guarded.');
        }
    }

    function verifiedAccessibleMedia() {
        const shadowVerified =
            state.scanPlan?.post === true &&
            state.coverage.publicShadow === true &&
            state.coverage.ownedHydration === true &&
            state.shadow.applicable === true &&
            state.shadow.pageInfoEnded === true &&
            String(state.shadow.profileId || '') === String(state.userId || '') &&
            state.shadow.postIds instanceof Set;

        return [...state.queue.values()].filter(m => {
            if (
                !m?.url || !m?.id || !m?.filename ||
                !(m.sources instanceof Set) ||
                ['FAN CLUB', 'HIDDEN'].includes(mediaArchiveCategory(m))
            ) return false;

            const id = String(m.id);

            if (m.type === 'POST') {
                if (!(m.rootIds instanceof Set)) return false;
                const publicProven = shadowVerified &&
                    [...m.rootIds].some(rootId =>
                        state.shadow.postIds.has(String(rootId))
                    ) &&
                    (
                        m.sources.has('PROFILE_PUBLIC_SHADOW') ||
                        m.sources.has('OWNED_DEEP_HYDRATION')
                    );
                const nativeIndividualProven =
                    state.scanPlan?.post === true &&
                    state.coverage.ownedHydration === true &&
                    m.sources.has('PROFILE_GRID_NATIVE') &&
                    state.verifiedPassiveProfilePostRootIds instanceof Set &&
                    [...m.rootIds].some(rootId =>
                        state.verifiedPassiveProfilePostRootIds.has(String(rootId))
                    );
                // Preserve download eligibility via a CURRENT completed
                // TAGGED collection for a previously native-verified POST.
                // Historical filenames do not grant current PROFILE proof.
                const taggedPresent = m.historicalPostArchiveContinuity === true &&
                    state.scanPlan?.tagged === true &&
                    state.coverage.tagged === true &&
                    m.sources.has('TAGGED') &&
                    [...m.rootIds].some(rootId =>
                        state.roots.TAGGED.has(String(rootId))
                    );
                return publicProven || nativeIndividualProven || taggedPresent;
            }

            if (m.type === 'REEL') {
                if (state.scanPlan?.reel !== true ||
                    !(m.rootIds instanceof Set)) return false;

                // Passive single-file observations can be archived when
                // their exact native response supplied the downloadable
                // unit, even if the complete Reels feed is unavailable.
                const passive = m.sources.has('REEL_NATIVE_OBSERVED') &&
                    state.verifiedPassiveReelRootIds instanceof Set &&
                    [...m.rootIds].some(rootId =>
                        state.verifiedPassiveReelRootIds.has(String(rootId))
                    );

                // Independently COMPLETE target-scoped REELS pagination
                // plus fully authenticated media-info hydration also
                // proves each REEL unit, even when the unrelated mixed
                // PROFILE grid remains INCOMPLETE. Never grant this for
                // a merely observed, unhydrated or unfinished Reels list.
                const nativeCompleted = state.coverage.reels === true &&
                    state.coverage.ownedHydration === true &&
                    m.sources.has('OWNED_DEEP_HYDRATION') &&
                    [...m.rootIds].some(rootId =>
                        state.roots.REEL.has(String(rootId))
                    );

                return passive || nativeCompleted;
            }

            if (m.type === 'TAGGED') {
                // A tagged item is not owned by the target account, but
                // it is part of this viewer's authenticated Web TAGGED
                // collection. Authorize only when the collection's server
                // pagination AND each returned media unit were reconciled.
                return state.scanPlan?.tagged === true &&
                    state.coverage.tagged === true &&
                    m.sources.has('TAGGED') &&
                    m.rootIds instanceof Set &&
                    [...m.rootIds].some(rootId =>
                        state.roots.TAGGED.has(String(rootId))
                    );
            }

            if (m.type === 'HIGHLIGHT') {
                return state.scanPlan?.highlight === true &&
                    state.coverage.highlights === true &&
                    // Every unit must refer to one recorded Instagram reel,
                    // not merely share a possibly duplicated display title.
                    !!m.highlightId &&
                    state.highlightCatalog.has(String(m.highlightId)) &&
                    m.sources.has('HIGHLIGHT_REEL:' + String(m.highlightId));
            }

            if (m.type === 'STORY') {
                return state.scanPlan?.story === true &&
                    state.coverage.story === true &&
                    // STORY is tracked by its authenticated Web GraphQL source.
                    m.sources.has('STORY_WEB_GRAPHQL');
            }

            if (m.type === 'AVATAR') {
                return state.scanPlan?.avatar === true &&
                    state.coverage.avatar === true &&
                    state.roots.AVATAR.has(id) &&
                    m.sources.has('AVATAR');
            }

            return false;
        });
    }

    // Bind surface completion proof and individual root identities to the
    // immutable snapshot, not merely the number of discovered files.
    function accessibleSourceProofFingerprint() {
        return JSON.stringify({
            userId: String(state.userId || ''),
            plan: {
                post: state.scanPlan?.post === true,
                reel: state.scanPlan?.reel === true,
                tagged: state.scanPlan?.tagged === true,
                highlight: state.scanPlan?.highlight === true,
                story: state.scanPlan?.story === true,
                avatar: state.scanPlan?.avatar === true,
            },
            coverage: {
                publicShadow: state.coverage.publicShadow === true,
                ownedHydration: state.coverage.ownedHydration === true,
                tagged: state.coverage.tagged === true,
                highlights: state.coverage.highlights === true,
                story: state.coverage.story === true,
                avatar: state.coverage.avatar === true,
            },
            shadow: {
                applicable: state.shadow.applicable === true,
                ended: state.shadow.pageInfoEnded === true,
                profileId: String(state.shadow.profileId || ''),
                postIds: [...state.shadow.postIds].map(String).sort(),
            },
            highlights: [...state.highlightCatalog.entries()]
                .map(([id, info]) => [id, info.title, info.folder])
                .sort((a, b) => a[0].localeCompare(b[0])),
            roots: {
                passiveReels: [...(state.verifiedPassiveReelRootIds || [])]
                    .map(String).sort(),
                passiveProfilePosts:
                    [...(state.verifiedPassiveProfilePostRootIds || [])]
                        .map(String).sort(),
                tagged: [...state.roots.TAGGED].map(String).sort(),
                highlight: [...state.roots.HIGHLIGHT].map(String).sort(),
                story: [...state.roots.STORY].map(String).sort(),
                avatar: [...state.roots.AVATAR].map(String).sort(),
            },
        });
    }


    // Source-level rules. Authorization, fingerprints and expiry are shared.
    function subscriberSourceProofVerified() {
        return state.scanPlan?.post === true &&
            state.scanPlan?.reel === true &&
            state.exclusive.known === true &&
            state.exclusive.hasExclusiveFeedContent === true &&
            state.coverage.connectedHidden === true &&
            state.coverage.ownedHydration === true &&
            state.hidden.candidates > 0 &&
            state.hidden.recovered > 0 &&
            state.hidden.failed === 0 &&
            state.hidden.previewOnly === 0 &&
            state.hidden.candidates ===
                state.hidden.recovered + state.hidden.alreadyOwned &&
            state.verifiedSubscriberRootIds.size === state.hidden.recovered;
    }

    function partialSourceVerified(mode) {
        if (mode === DOWNLOAD_MODE.SUBSCRIBER) {
            return subscriberSourceProofVerified();
        }
        if (mode === DOWNLOAD_MODE.ACCESSIBLE) {
            return !!state.scanPlan && !!state.userId && !!state.username;
        }
        return false;
    }

    function verifiedPartialMedia(mode) {
        if (mode === DOWNLOAD_MODE.SUBSCRIBER) return verifiedSubscriberMedia();
        if (mode === DOWNLOAD_MODE.ACCESSIBLE) return verifiedAccessibleMedia();
        return [];
    }

    function partialSourceFingerprint(mode) {
        if (mode === DOWNLOAD_MODE.ACCESSIBLE) {
            return accessibleSourceProofFingerprint();
        }
        if (mode !== DOWNLOAD_MODE.SUBSCRIBER) return '';

        return JSON.stringify({
            plan: {
                post: state.scanPlan?.post === true,
                reel: state.scanPlan?.reel === true,
            },
            exclusive: {
                known: state.exclusive.known === true,
                active: state.exclusive.hasExclusiveFeedContent === true,
            },
            coverage: {
                connectedHidden: state.coverage.connectedHidden === true,
                ownedHydration: state.coverage.ownedHydration === true,
            },
            hidden: {
                candidates: state.hidden.candidates,
                recovered: state.hidden.recovered,
                alreadyOwned: state.hidden.alreadyOwned,
                previewOnly: state.hidden.previewOnly,
                failed: state.hidden.failed,
            },
            verifiedRoots: [...state.verifiedSubscriberRootIds].map(String).sort(),
        });
    }

    // scanAll.running remains true until finally, after all phases stop.
    // This allows immutable grant capture, never a concurrent download.
    function capturePartialDownloadGrants() {
        clearPartialDownloadGrants();
        if (
            state.scanOutcome !== 'INCOMPLETE' ||
            state.scanComplete ||
            state.cancelled ||
            state.feedbackRequired ||
            state.rateLimited ||
            state.apiUnhealthy ||
            !state.scanPlan || !state.userId || !state.username
        ) return;

        for (const mode of PARTIAL_DOWNLOAD_MODES) {
            if (!partialSourceVerified(mode)) continue;
            const media = verifiedPartialMedia(mode);
            if (!media.length) continue;

            state.partialDownloadGrants[mode] = Object.freeze({
                mode,
                userId: String(state.userId),
                username: String(state.username),
                queueSize: state.queue.size,
                queueFingerprint: scanDownloadFingerprint(),
                sourceFingerprint: partialSourceFingerprint(mode),
                mediaIds: Object.freeze(media.map(m => String(m.id)).sort()),
                mediaCount: media.length,
            });

            log(
                mode === DOWNLOAD_MODE.SUBSCRIBER
                    ? 'SUBSCRIBER PARTIAL READY: ' +
                      state.hidden.recovered + ' authenticated roots, ' +
                      media.length + ' downloadable media. Overall PROFILE ' +
                      'remains INCOMPLETE. Use only the separate verified-media action.'
                    : 'ACCESSIBLE PARTIAL READY: ' + media.length +
                      ' media from independently verified surfaces. ' +
                      'PROFILE / REELS may still be INCOMPLETE; this is NOT a full archive.',
                'warn'
            );
        }
    }

    function verifiedPartialDownloadIntegrity(mode) {
        const fail = reason => ({ ok: false, reason });
        if (!PARTIAL_DOWNLOAD_MODES.includes(mode)) {
            return fail('unknown verified partial download mode');
        }
        const grant = state.partialDownloadGrants[mode];
        if (
            !grant || grant.mode !== mode ||
            state.scanOutcome !== 'INCOMPLETE' || state.scanComplete
        ) return fail('no verified ' + mode + ' grant from finished INCOMPLETE scan');

        if (
            state.running || state.cancelled || state.feedbackRequired ||
            state.rateLimited || state.apiUnhealthy
        ) return fail('scan/session stopped or Instagram safety circuit active');

        if (!partialSourceVerified(mode)) {
            return fail(mode + ' source authorization or hydration not verified');
        }
        if (
            String(state.userId) !== grant.userId ||
            String(state.username) !== grant.username ||
            cleanUser(ui.username?.value || currentProfile()) !== grant.username
        ) return fail('profile identity/input changed after scan');

        if (
            state.queue.size !== grant.queueSize ||
            scanDownloadFingerprint() !== grant.queueFingerprint ||
            partialSourceFingerprint(mode) !== grant.sourceFingerprint
        ) return fail('scan media inventory or source proof changed');

        const media = verifiedPartialMedia(mode);
        if (
            !media.length || media.length !== grant.mediaCount ||
            media.map(m => String(m.id)).sort().join('|') !==
                grant.mediaIds.join('|')
        ) return fail('verified partial media selection changed');

        return { ok: true, reason: '', media };
    }

    function authorizeDownloadScope(mode) {
        const fail = reason => ({ ok: false, reason });
        if (mode === DOWNLOAD_MODE.COMPLETE) {
            const integrity = completedScanIntegrity();
            if (!integrity.ok) return fail(integrity.reason);
            const incomplete = incompleteCoverage();
            if (incomplete.length) return fail('incomplete ' + incomplete.join(', '));
            return { ok: true, reason: '', media: [...state.queue.values()] };
        }
        return verifiedPartialDownloadIntegrity(mode);
    }

    function completedScanIntegrity() {
        if (
            !state.scanComplete ||
            !['COMPLETE', 'EXPOSED_COMPLETE'].includes(state.scanOutcome)
        ) {
            return {
                ok: false,
                reason: `last scan outcome=${state.scanOutcome || 'NONE'}`,
            };
        }

        if (state.scanOutcome === 'EXPOSED_COMPLETE' &&
            !reelsSurfaceSkipped() && !profileSurfaceOperationalSkip()) {
            return {
                ok: false,
                reason: 'Exposed-source operational skip lost its verified conditions',
            };
        }

        if (
            String(state.scanUserId || '') !==
            String(state.userId || '')
        ) {
            return {
                ok: false,
                reason: 'profile identity changed after scan',
            };
        }

        if (state.queue.size !== state.scanQueueSize) {
            return {
                ok: false,
                reason: `queue size changed (${state.scanQueueSize} → ${state.queue.size})`,
            };
        }

        const fingerprint = scanDownloadFingerprint();

        if (fingerprint !== state.scanQueueFingerprint) {
            return {
                ok: false,
                reason: 'queue fingerprint changed after scan',
            };
        }

        return {
            ok: true,
            reason: '',
        };
    }

    async function scanProfilerPhase(label, fn, timings) {
        /*
         * A native fetch/XHR hook can trip a fatal circuit asynchronously
         * between two phases. Never let the next phase navigate or send even
         * one request after that signal.
         */
        if (state.feedbackRequired) {
            throw feedbackCircuitBreak(
                state.feedbackMessage ||
                `${label}: Instagram returned feedback_required before phase start.`
            );
        }

        if (state.rateLimited) {
            throw rateLimitCircuitBreak(
                state.rateLimitMessage ||
                `${label}: Instagram returned HTTP 429 before phase start.`
            );
        }

        if (state.apiUnhealthy) {
            throw apiUnhealthyError(
                state.apiUnhealthyMessage ||
                `${label}: Instagram API session is unhealthy before phase start.`
            );
        }

        if (state.cancelled) {
            throw new Error('Cancelled');
        }

        beginScanProgressPhase(
            label
        );

        const before = scanProfilerSnapshot();
        const started = performance.now();
        let result;
        let failed = false;

        try {
            result = await fn();

            if (state.feedbackRequired) {
                throw feedbackCircuitBreak(
                    state.feedbackMessage
                );
            }

            if (state.rateLimited) {
                throw rateLimitCircuitBreak(
                    state.rateLimitMessage
                );
            }

            if (state.apiUnhealthy) {
                throw apiUnhealthyError(
                    state.apiUnhealthyMessage
                );
            }

            return result;
        }
        catch (e) {
            failed = true;
            throw e;
        }
        finally {
            const seconds =
                (performance.now() - started) / 1000;

            const after = scanProfilerSnapshot();

            finishScanProgressPhase(
                label,
                failed
            );

            timings.push({
                label,
                seconds,
                before,
                after,
                failed,
            });

            log(
                `[SCAN PROFILE] ${label}: ${seconds.toFixed(2)} s` +
                ` | Δqueue=${after.queue - before.queue}` +
                ` | Δowned=${after.owned - before.owned}` +
                ` | POST=${after.post}` +
                ` | REEL=${after.reel}` +
                ` | hidden=${after.hiddenRecovered}/${after.hiddenCandidates}` +
                ` | hydrated=${after.hydrated}/${after.hydrateTotal}` +
                ` | status=${failed ? 'ERROR' : 'done'}.`,
                failed ? 'warn' : ''
            );
        }
    }

    function logScanProfilerSummary(timings, totalSeconds) {
        log('=== SCAN PROFILER SUMMARY ===');

        for (const t of timings) {
            log(
                `[SCAN PROFILE] ${t.label.padEnd(18, ' ')} ` +
                `${t.seconds.toFixed(2)} s` +
                ` | Δqueue=${t.after.queue - t.before.queue}` +
                ` | Δowned=${t.after.owned - t.before.owned}.`
            );
        }

        const fp = scanProfilerInventory();

        log(
            `[SCAN PROFILE] TOTAL ${totalSeconds.toFixed(2)} s` +
            ` | OWNED=${ownedCount()}` +
            ` | QUEUE=${state.queue.size}` +
            ` | fingerprints: OWNED=${fp.ownedRoots}, ROOTS=${fp.allRoots}, QUEUE=${fp.queuedMedia}.`
        );

        log(
            `[SCAN PROFILE] coverage guards: ` +
            `PROFILE=${state.coverage.profileGrid}, ` +
            `PUBLIC_SHADOW=${shadowCoverageLabel()}, ` +
            `CONNECTED_HIDDEN=${state.coverage.connectedHidden}, ` +
            `REELS=${reelsSurfaceSkipped() ? 'SKIPPED_NO_TAB' : state.coverage.reels}, ` +
            `OWNED_HYDRATION=${state.coverage.ownedHydration}, ` +
            `TAGGED=${state.coverage.tagged}, ` +
            `HIGHLIGHTS=${state.coverage.highlights}, ` +
            `STORY=${state.coverage.story}, ` +
            `AVATAR=${state.coverage.avatar}.`
        );
    }

    function assessProfileGridCrossSurfaceProof(proof = {}) {
        // Do not infer PROFILE completeness from the counter alone:
        // every candidate source must be identity scoped and have
        // independent server-reported end-of-pagination evidence.
        const fail = (reason,missing=0) =>
            ({verified:false,reason,missing});

        if (!proof.selectedPost || !proof.selectedReel) {
            return fail('post_and_reel_scans_required');
        }
        if (
            !proof.publicProfile ||
            !proof.exclusiveKnown ||
            proof.hasExclusive ||
            !proof.shadowApplicable
        ) return fail('public_access_equivalence_unavailable');

        if (
            !proof.profileId ||
            proof.profileId !== proof.shadowProfileId
        ) return fail('profile_identity_unverified');

        if (!proof.shadowComplete || !proof.shadowPageInfoEnd) {
            return fail('public_timeline_end_unproven');
        }

        const expected = Number(proof.expected);
        const publicRoots = proof.publicRootIds;
        const publicPosts = proof.publicPostIds;
        const publicReels = proof.publicReelIds;
        if (
            !Number.isSafeInteger(expected) ||
            expected <= 0 ||
            proof.counterVerified !== true ||
            !(publicRoots instanceof Set) ||
            !(publicPosts instanceof Set) ||
            !(publicReels instanceof Set) ||
            publicRoots.size > expected ||
            publicPosts.size + publicReels.size !== publicRoots.size
        ) return fail('public_timeline_counter_or_partition_mismatch');

        for (const id of publicPosts) {
            if (!publicRoots.has(id) || publicReels.has(id)) {
                return fail('public_root_partition_invalid');
            }
        }
        for (const id of publicReels) {
            if (!publicRoots.has(id) || publicPosts.has(id)) {
                return fail('public_root_partition_invalid');
            }
        }

        // PROFILE is the MAIN GRID. The independent REELS tab may be
        // unavailable, but that must not invalidate an exhaustively
        // paginated and identity-scoped PUBLIC main grid. REELS completeness
        // remains an independent mandatory guard for a full archive.
        if (
            !proof.connectedHiddenComplete ||
            !proof.ownedHydrationComplete ||
            proof.hiddenCandidates !== 0 ||
            proof.hiddenRecovered !== 0 ||
            proof.hiddenPreviewOnly !== 0 ||
            proof.hiddenFailed !== 0
        ) return fail('connected_surfaces_not_equivalent');

        if (
            !(proof.ownedPostIds instanceof Set) ||
            !(proof.ownedReelIds instanceof Set)
        ) return fail('owned_root_sets_unavailable');

        let missing = 0;
        for (const id of publicPosts) {
            // PUBLIC SHADOW can label a mixed-grid Reel as a POST.
            // The authenticated REELS surface takes precedence and moves
            // the same owned root from POST to REEL. Its identity still
            // reconciles, provided the completed REELS coverage is proven.
            if (
                !proof.ownedPostIds.has(id) &&
                !proof.ownedReelIds.has(id)
            ) missing++;
        }
        for (const id of publicReels) {
            // An explicitly marked public Reel must also be owned as REEL.
            if (!proof.ownedReelIds.has(id)) missing++;
        }
        if (missing) return fail('public_roots_not_reconciled',missing);

        // The anonymous timeline occasionally omits a valid root that
        // was observed in a target-scoped authenticated native response.
        // Accept an aggregate end proof only if BOTH sources ended:
        // the public timeline and a real native continuation. A
        // mid-scroll native response with no end marker is insufficient.
        if (publicRoots.size < expected) {
            const native = proof.nativeRootIds;
            if (
                proof.nativeContinuationPages < 1 ||
                !proof.nativePageInfoEnd ||
                !proof.nativeLastHasNextFalse ||
                !(native instanceof Set) ||
                native.size === 0
            ) return fail('authenticated_native_end_unproven');

            const allRoots = new Set(publicRoots);
            let overlap = 0;
            let nativeUnowned = 0;
            for (const id of native) {
                if (
                    typeof id !== 'string' ||
                    !/^\d+$/.test(id)
                ) return fail('authenticated_native_identity_invalid');

                if (publicRoots.has(id)) overlap++;
                allRoots.add(id);
                if (
                    !proof.ownedPostIds.has(id) &&
                    !proof.ownedReelIds.has(id)
                ) nativeUnowned++;
            }

            if (nativeUnowned) {
                return fail('authenticated_native_roots_not_reconciled',nativeUnowned);
            }
            if (overlap < 1) {
                return fail('public_native_overlap_unproven');
            }
            if (allRoots.size !== expected) {
                return fail(
                    'public_native_union_counter_mismatch',
                    Math.max(0,expected-allRoots.size)
                );
            }

            return {
                verified:true,
                reason:'public_native_union_cross_surface_proof',
                missing:0,
                publicCount:publicRoots.size,
                nativeCount:native.size,
                overlap,
                unionCount:allRoots.size,
            };
        }

        return {
            verified:true,
            reason:'public_connected_cross_surface_proof',
            missing:0,
            publicCount:publicRoots.size,
            nativeCount:0,
            overlap:0,
            unionCount:publicRoots.size,
        };
    }

    // Conservatively reconcile a small gap AFTER BOTH target-scoped
    // PUBLIC and native timelines have proven server pagination end.
    // A visible DOM link cannot prove the end. A fresh, exact-owner,
    // exact-shortcode, full-child media-info response can account for
    // an otherwise missing individual POST identity. Never fill gaps
    // from independent REELS, unverified DOM links, or counter alone.
    function assessProfileDomApiSupplementProof(p = {}) {
        const fail = reason => ({verified:false,reason,missing:p?.base?.missing || 0});
        if (p?.base?.verified !== false ||
            p.base.reason !== 'public_native_union_counter_mismatch' ||
            !Number.isSafeInteger(p.base.missing) ||
            p.base.missing < 1) return fail('not_a_verified_native_public_gap');
        const expected=Number(p.expected);
        const pub=p.publicRootIds, native=p.nativeRootIds,
            main=p.mainRootIds, dom=p.domObservedRootIds,
            api=p.verifiedDomApiRootIds, posts=p.ownedPostIds,
            reels=p.ownedReelIds;
        if (!Number.isSafeInteger(expected) || expected < 1 ||
            ![pub,native,main,dom,api,posts,reels]
                .every(value => value instanceof Set))
            return fail('missing_identity_scoped_root_sets');
        const union=new Set([...pub,...native]);
        if (union.size >= expected ||
            expected - union.size !== p.base.missing ||
            main.size !== expected ||
            // Instagram virtualizes PROFILE tiles. The DOM need not
            // retain every PUBLIC/native-proven parent at scan end.
            // It must never contain an unrelated root, though.
            [...dom].some(id => !main.has(id)) ||
            [...union].some(id => !main.has(id)))
            return fail('profile_dom_main_count_or_membership_mismatch');
        const missing=[...main].filter(id => !union.has(id));
        if (missing.length !== p.base.missing ||
            missing.some(id => !/^\d+$/.test(String(id)) ||
                !dom.has(id) || !api.has(id) ||
                !posts.has(id) || reels.has(id)))
            return fail('profile_dom_media_info_not_independently_proven');
        // Independent completed REELS may contain more posts than the
        // main grid; never use them as a source of missing PROFILE IDs.
        return {
            verified:true,
            reason:'public_native_dom_api_exact_counter_proof',
            missing:0,
            publicCount:pub.size,
            nativeCount:native.size,
            overlap:pub.size+native.size-union.size,
            unionCount:main.size,
            domApiSupplementCount:missing.length,
        };
    }

    // Public profiles have an authenticated user counter AND an
    // identity-verified anonymous main-grid connection. Use those real
    // independent surfaces first. No native client traffic is required
    // if the grid's own server end and every expected POST are proven.
    // A separate REELS tab is never inferred from this proof.
    function verifiedPublicGridPrimaryProof() {
        const fail = reason => ({ verified: false, reason });
        if (
            !scanSelected('post') ||
            !scanSelected('reel') ||
            state.profileInfo?.is_private !== false ||
            state.exclusive.known !== true ||
            state.exclusive.hasExclusiveFeedContent === true ||
            !state.shadow.applicable ||
            !state.coverage.publicShadow ||
            !state.shadow.pageInfoEnded ||
            String(state.shadow.profileId || '') !== String(state.userId || '')
        ) return fail('public_source_not_applicable');

        const count = Number(state.profileInfo?.media_count);
        if (
            !Number.isSafeInteger(count) ||
            count < 1 ||
            count !== Number(state.expected) ||
            !(state.shadow.rootIds instanceof Set) ||
            !(state.shadow.postIds instanceof Set) ||
            !(state.shadow.reelIds instanceof Set) ||
            state.shadow.rootIds.size !== count ||
            state.shadow.postIds.size !== count ||
            state.shadow.reelIds.size !== 0
        ) return fail('counter_or_public_pagination_not_exhaustive');

        for (const id of state.shadow.postIds) {
            if (
                !state.shadow.rootIds.has(id) ||
                (!state.roots.POST.has(id) && !state.roots.REEL.has(id))
            ) return fail('public_post_not_hydrated');
        }
        return { verified: true, reason: 'public_server_end_exact_counter', count };
    }

    // A missing REELS navigation link is *not* proof of zero Reels.
    // A target-scoped Instagram profile API can also return an explicit
    // clips count. Accept absence only when that raw count is exactly
    // zero AND the independent public timeline is exhausted, the account
    // matches, no Reel root is observed, and the tab is genuinely absent.
    // Unknown, nonzero and conflicting metadata always fail closed.
    function explicitEmptyReelsProof() {
        const fail = reason => ({ verified: false, reason });
        const info = state.profileInfo;
        const id = String(info?.pk || info?.id || '').split('_')[0];
        if (!id || id !== String(state.userId || '')) {
            return fail('profile_clip_count_identity_unverified');
        }

        const ssr = state.shadow.reelsEvidence;
        if (ssr) {
            if (
                ssr.profileId !== String(state.userId || '') ||
                ssr.username !== String(state.username || '').toLowerCase()
            ) return fail('public_ssr_identity_unverified');

            if (ssr.consistent !== true) {
                return fail('public_ssr_clips_metadata_conflict');
            }
        }

        const rawCount = info?.total_clips_count;
        const countValid = typeof rawCount === 'number'
            ? Number.isSafeInteger(rawCount) && rawCount >= 0
            : typeof rawCount === 'string' && /^\d+$/.test(rawCount) &&
              Number.isSafeInteger(Number(rawCount));
        const apiCount = countValid ? Number(rawCount) : null;
        const apiZero = apiCount === 0;

        // Only two genuine Instagram signals may support absence:
        // a profile-scoped explicit count of zero from authenticated
        // USER INFO, or explicit zero/false in the exact SSR user object.
        // Missing fields, missing navigation and POST counts are NEVER
        // promoted into a synthetic zero-clips assertion.
        const ssrZero = ssr?.consistent === true &&
            (ssr.hasAnyClips === false || ssr.totalClipsCount === 0);

        if (
            apiCount > 0 ||
            info?.has_clips === true ||
            info?.has_any_clips === true ||
            ssr?.hasAnyClips === true ||
            ssr?.totalClipsCount > 0
        ) return fail('profile_reports_clips');

        if (!apiZero && !ssrZero) {
            return fail('clips_absence_not_explicitly_reported');
        }

        if (!verifiedPublicGridPrimaryProof().verified) {
            return fail('public_main_grid_not_verified');
        }
        if (
            state.coverage.profileGrid !== true ||
            state.coverage.connectedHidden !== true ||
            state.coverage.ownedHydration !== true ||
            state.hidden.candidates !== 0 ||
            state.hidden.recovered !== 0 ||
            state.hidden.previewOnly !== 0 ||
            state.hidden.failed !== 0 ||
            state.roots.REEL.size !== 0 ||
            state.shadow.reelIds.size !== 0 ||
            (net.reelsByUserId.get(state.userId)?.size || 0) !== 0
        ) return fail('other_reel_or_hidden_source_unreconciled');

        const target = `/${state.username}/reels/`;
        if (
            pathNorm(location.pathname) === pathNorm(target) ||
            findAnchor(target)
        ) return fail('reels_tab_present');

        return {
            verified: true,
            reason: 'explicit_zero_clips_and_verified_public_grid_end',
            source: apiZero
                ? 'authenticated_user_info_total_clips_count'
                : ssr.totalClipsCount === 0
                    ? 'public_ssr_total_clips_count'
                    : 'public_ssr_has_any_clips_false',
        };
    }

    // Three different questions must NEVER be conflated:
    // 1. Was REELS independently proven complete?
    // 2. Is a native Reels surface exposed to this browser?
    // 3. Can another verified surface still be archived?
    // NOT_EXPOSED is a UI observation, not a claim of zero clips.
    // The result is diagnostic only and cannot grant full download.
    function classifyReelsEvidence(input) {
        const x = input || {};
        if (!x.selected) return {kind:'NOT_SELECTED', reason:'selection_off'};
        if (x.proven) return {
            kind:'PROVEN', reason:'independent_reels_server_proof',
        };
        if (x.nativeTab || x.knownClips) return {
            kind:'UNVERIFIED', reason:x.knownClips
                ? 'clips_observed_without_exhaustive_pagination'
                : 'native_tab_without_server_end',
        };
        if (x.metadataConflict) return {
            kind:'UNKNOWN', reason:'contradictory_clips_metadata',
        };
        if (x.publicGridVerified &&
            x.connectedHiddenVerified &&
            x.ownedHydrationVerified &&
            x.exclusiveKnown && !x.exclusiveAvailable) {
            return {
                kind:'NOT_EXPOSED',
                reason:'no_native_reels_tab_and_no_explicit_zero_metadata',
            };
        }
        return {
            kind:'UNKNOWN',
            reason:'insufficient_independent_surface_evidence',
        };
    }

    function reconcileEmptyReelsCoverage() {
        if (!scanSelected('reel')) {
            state.reelsDiagnosis = {
                kind:'NOT_SELECTED', reason:'selection_off', source:'',
            };
            return;
        }

        let proof = null;
        if (state.coverage.reels !== true) {
            proof = explicitEmptyReelsProof();
            if (proof.verified) {
                state.coverage.reels = true;
                log(
                    'REELS independently proven EMPTY: explicit Instagram ' +
                    'source=' + proof.source + '; PUBLIC grid ended and fully ' +
                    'reconciles the official media counter; no Reel/hidden ' +
                    'candidate or REELS tab exists. No unverified GraphQL ' +
                    'query was attempted.'
                );
            }
        }

        const count = state.profileInfo?.total_clips_count;
        const ssr = state.shadow.reelsEvidence;
        const tabPath = `/${state.username}/reels/`;
        const nativeTab = pathNorm(location.pathname) === pathNorm(tabPath) ||
            !!findAnchor(tabPath);
        const knownClips = (
            state.roots.REEL.size > 0 ||
            (net.reelsByUserId.get(state.userId)?.size || 0) > 0 ||
            state.shadow.reelIds.size > 0 ||
            Number(count) > 0 ||
            state.profileInfo?.has_clips === true ||
            state.profileInfo?.has_any_clips === true ||
            ssr?.hasAnyClips === true ||
            Number(ssr?.totalClipsCount) > 0
        );

        const verdict = classifyReelsEvidence({
            selected:true,
            proven:state.coverage.reels === true,
            nativeTab,
            knownClips,
            metadataConflict:ssr?.consistent === false,
            publicGridVerified:verifiedPublicGridPrimaryProof().verified,
            connectedHiddenVerified:state.coverage.connectedHidden === true &&
                state.hidden.failed === 0 &&
                state.hidden.previewOnly === 0,
            ownedHydrationVerified:state.coverage.ownedHydration === true,
            exclusiveKnown:state.exclusive.known === true,
            exclusiveAvailable:state.exclusive.hasExclusiveFeedContent === true,
        });

        state.reelsDiagnosis = Object.freeze({
            ...verdict,
            source:proof?.verified ? proof.source :
                state.coverage.reels === true
                    ? 'native_web_reels_connection'
                    : '',
        });

        if (state.coverage.reels === true) return;

        // A non-exposed tab is not a failed network attempt, nor proof
        // of no Reels. It may be skipped operationally once the other
        // independent sources have verified their coverage.
        const detail = state.reelsDiagnosis.kind === 'NOT_EXPOSED'
            ? 'No REELS tab or explicit zero-count was exposed. ' +
              'No Reel is visible; the inaccessible tab is skipped when ' +
              'all other selected sources verify. Full REELS exhaustiveness ' +
              'remains UNKNOWN, not proven zero.'
            : 'No verified REELS server-end: ' +
              (proof?.reason || state.reelsDiagnosis.reason) + '.';
        log(
            'REELS evidence=' + state.reelsDiagnosis.kind +
            ', reason=' + state.reelsDiagnosis.reason +
            ', raw_total_clips_count=' +
            (count == null ? '-' : String(count)) +
            ', ssr_has_any_clips=' + (ssr?.hasAnyClips ?? '-') +
            ', ssr_total_clips_count=' + (ssr?.totalClipsCount ?? '-') +
            '. ' + detail + ' No speculative REELS requests.',
            'warn'
        );
    }

    function reconcileProfileGridCoverage() {
        if (
            state.coverage.profileGrid ||
            !scanSelected('post')
        ) return;

        let result = assessProfileGridCrossSurfaceProof({
            selectedPost: scanSelected('post'),
            selectedReel: scanSelected('reel'),
            publicProfile: state.profileInfo?.is_private === false,
            exclusiveKnown: state.exclusive.known === true,
            hasExclusive: state.exclusive.hasExclusiveFeedContent === true,
            shadowApplicable: state.shadow.applicable === true,
            profileId: String(state.userId || ''),
            shadowProfileId: String(state.shadow.profileId || ''),
            shadowComplete: state.coverage.publicShadow === true,
            shadowPageInfoEnd: state.shadow.pageInfoEnded === true,
            expected: state.expected,
            counterVerified:
                Number.isSafeInteger(Number(state.profileInfo?.media_count)) &&
                Number(state.profileInfo.media_count) === Number(state.expected) &&
                Number(state.expected) > 0,
            nativeRootIds: new Set(
                net.gridByUser.get(state.username.toLowerCase())?.keys() || []
            ),
            nativeContinuationPages:
                net.gridNativeAuditByUser.get(
                    state.username.toLowerCase()
                )?.continuation || 0,
            nativePageInfoEnd:
                net.gridPageInfo.get(
                    state.username.toLowerCase()
                )?.has_next_page === false,
            nativeLastHasNextFalse:
                net.gridNativeAuditByUser.get(
                    state.username.toLowerCase()
                )?.lastHasNext === 'false',
            publicRootIds: state.shadow.rootIds,
            publicPostIds: state.shadow.postIds,
            publicReelIds: state.shadow.reelIds,
            reelsComplete: state.coverage.reels === true,
            connectedHiddenComplete: state.coverage.connectedHidden === true,
            ownedHydrationComplete: state.coverage.ownedHydration === true,
            hiddenCandidates: state.hidden.candidates,
            hiddenRecovered: state.hidden.recovered,
            hiddenPreviewOnly: state.hidden.previewOnly,
            hiddenFailed: state.hidden.failed,
            ownedPostIds: state.roots.POST,
            ownedReelIds: state.roots.REEL,
        });

        if (!result.verified &&
            result.reason === 'public_native_union_counter_mismatch') {
            const supplement = assessProfileDomApiSupplementProof({
                base: result,
                expected: state.expected,
                publicRootIds: state.shadow.rootIds,
                nativeRootIds: new Set(
                    net.gridByUser.get(state.username.toLowerCase())?.keys() || []
                ),
                mainRootIds: state.profileMainGridRootIds,
                domObservedRootIds: state.profileDomObservedRootIds,
                verifiedDomApiRootIds: state.verifiedProfileDomApiRootIds,
                ownedPostIds: state.roots.POST,
                ownedReelIds: state.roots.REEL,
            });
            if (supplement.verified) {
                result = supplement;
                log('PROFILE precise gap corroborated by ' +
                    supplement.domApiSupplementCount +
                    ' same-owner DOM media-info POST roots. Both public ' +
                    'and native server-ended timelines were already proven. ' +
                    'No synthetic PROFILE Relay or counter-only shortcut.');
            } else {
                log('PROFILE strict DOM media-info supplement unavailable: ' +
                    supplement.reason +
                    ' (main=' + state.profileMainGridRootIds.size +
                    ', observed_dom=' + state.profileDomObservedRootIds.size +
                    ', verified_dom_api=' + state.verifiedProfileDomApiRootIds.size +
                    ', public_native_union=' +
                    new Set([
                        ...state.shadow.rootIds,
                        ...(net.gridByUser.get(state.username.toLowerCase())?.keys() || [])
                    ]).size +
                    ').');
            }
        }

        if (result.verified) {
            state.coverage.profileGrid = true;
            log(
                'PROFILE grid independently reconciled: ' +
                'proof=' + result.reason +
                ', public=' + result.publicCount +
                ', native=' + result.nativeCount +
                ', overlap=' + result.overlap +
                ', union=' + result.unionCount +
                ', expected=' + state.expected +
                '. PUBLIC SHADOW ended; HIDDEN/HYDRATION verified. ' +
                'REELS has its own independent coverage guard. ' +
                'Native PROFILE initial capture may remain unverified.',
                'warn'
            );
        }
        else {
            log(
                'PROFILE grid cross-surface proof unavailable: ' +
                result.reason +
                (result.missing ? ', missing=' + result.missing : '') +
                '. Native PROFILE coverage stays INCOMPLETE.',
                'warn'
            );
        }
    }

    async function scanAll() {
        if (
            state.running ||
            state.downloading
        ) {
            return;
        }

        if (
            state.feedbackRequired ||
            state.rateLimited ||
            state.apiUnhealthy
        ) {
            const stopReason = state.feedbackRequired
                ? 'feedback_required'
                : state.rateLimited
                    ? 'HTTP 429'
                    : 'an invalid Instagram API response';

            status(
                `SCAN blocked in this page session after ${stopReason}. ` +
                `Reload Instagram later before retrying.`,
                'warn'
            );
            return;
        }

        const username = cleanUser(
            ui.username.value ||
            currentProfile()
        );

        if (!username) {
            status(
                'Enter a profile username.',
                'error'
            );

            return;
        }

        state.running = true;
        state.cancelled = false;
        state.feedbackRequired = false;
        state.feedbackMessage = '';
        state.rateLimited = false;
        state.rateLimitMessage = '';
        state.apiUnhealthy = false;
        state.apiUnhealthyMessage = '';
        state.scanPlan = Object.freeze(currentScanSelection());
        resetScanProgress(
            state.scanPlan
        );
        state.scanComplete = false;
        state.scanOutcome = 'RUNNING';
        state.nativeProfileEvidenceSession = null;
        state.scanUserId = '';
        state.scanQueueSize = 0;
        state.scanQueueFingerprint = '';

        state.queue.clear();
        state.rootCatalog.clear();
        // Fresh per-scan snapshots; resilient to older in-memory test fixtures.
        state.profileMainGridRootIds = new Set();
        state.profileDomObservedRootIds = new Set();
        state.verifiedProfileDomApiRootIds = new Set();

        for (const s of Object.values(state.roots)) {
            s.clear();
        }

        resetCoverage();

        state.profileInfo = null;
        state.exclusive = {
            known: false,
            hasExclusiveFeedContent: false,
            fanClubId: '',
            subscriberCount: null,
            autosaveExclusiveHighlight: false,
            postsStatus: '',
            reelsStatus: '',
            storiesStatus: '',
            liveStatus: '',
        };

        state.downloaded = 0;
        state.failed = 0;
        resetDownloadProgress('idle');

        disable(true);

        const scanProfilerTimings = [];
        const scanProfilerStarted = performance.now();

        try {
            await scanProfilerPhase(
                'PROFILE INFO',
                async () => {
                    await resolveProfile(username);
                    return refreshProfileInfo();
                },
                scanProfilerTimings
            );

            const nativeBootstrap = prepareProfileNativeEvidenceForScan(
                state.username.toLowerCase()
            );
            log(nativeBootstrap.retained
                ? 'PROFILE native bootstrap preserved: ' +
                  nativeBootstrap.roots + ' roots, ' +
                  'age=' + nativeBootstrap.ageMs + ' ms, ' +
                  'has_next=' + nativeBootstrap.pageInfo.has_next_page + '.'
                : 'PROFILE native bootstrap unavailable or stale; ' +
                  'a fresh verified server response is required.');
            // The native snapshot was verified as fresh at scan entry.
            // PUBLIC SHADOW can take >20s without invalidating this scan.
            const profileEvidenceKey = state.username.toLowerCase();
            state.nativeProfileEvidenceSession = {
                key:profileEvidenceKey,
                userId:String(state.userId || ''),
                acceptedAt:Date.now(),
                acceptedCapturedAt:nativeBootstrap.retained
                    ? net.gridCaptureSeenAtByUser.get(profileEvidenceKey)
                    : null,
            };
            const reelBootstrap = prepareReelsNativeEvidenceForScan(
                state.userId
            );
            if (reelBootstrap.retained) {
                log(
                    'REELS native Web bootstrap preserved: ' +
                    reelBootstrap.roots + ' already-observed roots, age=' +
                    reelBootstrap.ageMs + ' ms; no additional request.'
                );
            }

            net.taggedDocInitial = '';
            net.taggedDocConnection = '';
            net.taggedNativeVariables = null;
            net.taggedInitialData = null;
            net.taggedInitialUserId = '';
            const taggedBootstrap = prepareTaggedNativeEvidenceForScan(
                state.userId
            );
            if (scanSelected('tagged') && taggedBootstrap.retained) {
                log(
                    'TAGGED native Web bootstrap preserved: ' +
                    taggedBootstrap.roots + ' first-page roots, age=' +
                    taggedBootstrap.ageMs + ' ms; no duplicate first request.'
                );
            }

            net.highlightTrayDoc = '';
            net.highlightTrayFriendly = '';
            net.highlightTrayVariables = null;
            net.highlightTrayEndpoint = '';
            net.highlightTrayData = null;
            net.highlightTrayUserId = '';

            updateStats();

            // Server-backed, identity-verified PUBLIC timeline is the
            // primary source for PUBLIC grids. A native browser hook is an
            // optional fallback, not a prerequisite that consumes 14 s
            // waiting for a cached SPA request that never occurs.
            if (scanSelected('post')) {
                await scanProfilerPhase(
                    'PUBLIC SHADOW',
                    scanPublicShadow,
                    scanProfilerTimings
                );
            }

            if (scanSelected('post') || scanSelected('reel')) {
                const publicProof = verifiedPublicGridPrimaryProof();
                if (publicProof.verified) {
                    log(
                        'PROFILE native phase not needed: the independent PUBLIC ' +
                        'timeline ended on the server and exactly reconciles ' +
                        publicProof.count + ' hydrated main-grid roots. ' +
                        'REELS coverage remains independent.'
                    );
                    await scanProfilerPhase(
                        'PROFILE GRID',
                        async () => true,
                        scanProfilerTimings
                    );
                }
                else {
                    log('PROFILE public proof insufficient (' +
                        publicProof.reason +
                        '); using authenticated native PROFILE pass.');
                    await scanProfilerPhase(
                        'PROFILE GRID',
                        scanMainGrid,
                        scanProfilerTimings
                    );
                }
            }

            if (scanSelected('post') || scanSelected('reel')) {
                await scanProfilerPhase(
                    'CONNECTED HIDDEN',
                    scanConnectedHiddenCandidates,
                    scanProfilerTimings
                );
            }

            if (scanSelected('reel')) {
                await scanProfilerPhase(
                    'REELS',
                    scanReels,
                    scanProfilerTimings
                );
            }

            if (scanSelected('tagged')) {
                await scanProfilerPhase(
                    'TAGGED',
                    scanTagged,
                    scanProfilerTimings
                );
            }

            if (scanSelected('highlight')) {
                await scanProfilerPhase(
                    'HIGHLIGHTS',
                    scanHighlights,
                    scanProfilerTimings
                );
            }

            if (scanSelected('story')) {
                await scanProfilerPhase(
                    'STORY',
                    scanStory,
                    scanProfilerTimings
                );
            }

            if (scanSelected('avatar')) {
                await scanProfilerPhase(
                    'AVATAR',
                    scanAvatar,
                    scanProfilerTimings
                );
            }

            if (scanSelected('post') || scanSelected('reel')) {
                await scanProfilerPhase(
                    'DEEP HYDRATION',
                    hydrateOwnedRootsDeep,
                    scanProfilerTimings
                );
            }

            // A missed authenticated PROFILE hook is not itself
            // proof that the public, reels and hidden timelines are
            // incomplete. Reconcile once all selected passes have
            // completed, using strict cross-surface evidence.
            reconcileProfileGridCoverage();
            reconcileEmptyReelsCoverage();
            reconcilePassiveProfilePostRoots();
            const profileEvidence = profileSourceDiagnosticSnapshot();
            const c = profileEvidence.counts;
            log(
                'PROFILE SOURCE AUDIT (diagnostic only): ' +
                'expected=' + (profileEvidence.expectedAuthenticated ?? '-') +
                ', main=' + c.mainGridSnapshot +
                ', main_gap=' + (c.gapMainVsCounter ?? '-') +
                ', public=' + c.public +
                ', native=' + c.native +
                ', public_native_union=' + c.publicNativeUnion +
                ', public_native_gap=' + (c.gapPublicNativeVsCounter ?? '-') +
                ', dom_candidates=' + c.domCandidates +
                ', main_outside_public_native=' + c.mainOutsidePublicNative +
                ', independent_reels=' + c.independentNativeReels +
                ', main_reels_overlap=' + c.mainAlsoInIndependentReels +
                '. DOM/reels never grant PROFILE completeness.',
                c.gapMainVsCounter ? 'warn' : 'info'
            );
            updateStats();

            logScanProfilerSummary(
                scanProfilerTimings,
                (performance.now() - scanProfilerStarted) / 1000
            );

            const incomplete = incompleteCoverage();
            const gap = globalGap();

            if (
                !incomplete.length &&
                !state.cancelled &&
                !state.feedbackRequired &&
                !state.rateLimited &&
                !state.apiUnhealthy
            ) {
                state.scanComplete = true;
                const reelsSkipped = reelsSurfaceSkipped();
                const profileSkipped = profileSurfaceOperationalSkip();
                state.scanOutcome = reelsSkipped || profileSkipped
                    ? 'EXPOSED_COMPLETE' : 'COMPLETE';
                state.scanUserId = String(state.userId || '');
                state.scanQueueSize = state.queue.size;
                state.scanQueueFingerprint = scanDownloadFingerprint();

                status(
                    profileSkipped
                        ? `Verified exposed archive ready: ${state.queue.size} media. PROFILE server-end unproven; no claim of exhaustive profile.`
                        : reelsSkipped
                            ? `Exposed sources complete: ${state.queue.size} unique media. REELS tab absent; skipped (no zero-clips proof).`
                            : `Accessible scan complete: ${state.queue.size} unique media.`,
                    'ok'
                );

                log(
                    `Accessible scan complete. ` +
                    `GLOBAL=${state.expected || '?'}, ` +
                    `OWNED=${ownedCount()}, ` +
                    `GAP=${gap}, ` +
                    `POST=${state.roots.POST.size}, ` +
                    `REEL=${state.roots.REEL.size}, ` +
                    `PUBLIC_EXTRAS=${state.shadow.extras}, ` +
                    `CONNECTED_HIDDEN=${state.hidden.recovered}/${state.hidden.candidates}, ` +
                    `HYDRATED=${state.hydration.hydratedRoots}/${state.hydration.totalRoots}, ` +
                    `EXCLUSIVE=${state.exclusive.known
                        ? (state.exclusive.hasExclusiveFeedContent ? 'YES' : 'NO')
                        : 'UNKNOWN'}, ` +
                    `files=${state.queue.size}.`
                );

                if (
                    state.expected > 0 &&
                    gap > 0
                ) {
                    log(
                        `Global counter gap=${gap}. ` +
                        `This does NOT block accessible backup` +
                        (state.exclusive.hasExclusiveFeedContent
                            ? ' because Instagram reports exclusive feed content for this profile.'
                            : '.'),
                        'warn'
                    );
                }

                log(
                    profileSkipped
                        ? '=== SCAN FINISHED — VERIFIED EXPOSED ARCHIVE (PROFILE SERVER-END UNPROVEN) ==='
                        : reelsSkipped
                            ? '=== SCAN FINISHED — EXPOSED SOURCES COMPLETE (REELS SKIPPED) ==='
                            : '=== SCAN FINISHED — COMPLETE ===',
                    'ok'
                );
            }
            else {
                state.scanComplete = false;
                state.scanOutcome = 'INCOMPLETE';

                const isolatedReelsUnknown =
                    incomplete.length === 1 &&
                    incomplete[0] === 'REELS tab' &&
                    state.reelsDiagnosis?.kind === 'NOT_EXPOSED';

                status(
                    isolatedReelsUnknown
                        ? 'Verified exposed sources complete; REELS not exposed/unknown. ' +
                          'Full download locked; verified accessible partial archive available.'
                        : `Scan INCOMPLETE: ${incomplete.join(', ') || 'scan state invalid'}. Full download locked; verified partial modes may be available.`,
                    'warn'
                );

                log(
                    `Accessible scan incomplete: ${incomplete.join(', ') || 'scan state invalid'}.`,
                    'warn'
                );

                if (isolatedReelsUnknown) {
                    log(
                        'EXPOSED SOURCES VERIFIED — REELS UNOBSERVABLE. ' +
                        'This is NOT a full archive. No further REELS API probes were made.',
                        'warn'
                    );
                }

                log('=== SCAN FINISHED — INCOMPLETE ===', 'warn');

                // Only after every scan phase has stopped. This never
                // changes PROFILE coverage or scanOutcome to COMPLETE.
                capturePartialDownloadGrants();
                updateStats();
            }
        }
        catch (e) {
            if (
                e?.code === 'IG_FEEDBACK_REQUIRED' ||
                state.feedbackRequired
            ) {
                state.cancelled = true;
                state.scanComplete = false;
                state.scanOutcome = 'FEEDBACK_REQUIRED';

                status(
                    'Instagram feedback_required: scan stopped to protect the session.',
                    'warn'
                );

                log(
                    state.feedbackMessage || e.message,
                    'warn'
                );

                log(
                    '=== SCAN STOPPED — INSTAGRAM FEEDBACK_REQUIRED ===',
                    'warn'
                );
            }
            else if (
                e?.code === 'IG_RATE_LIMITED' ||
                state.rateLimited
            ) {
                state.cancelled = true;
                state.scanComplete = false;
                state.scanOutcome = 'RATE_LIMITED';

                status(
                    'Instagram HTTP 429: scan stopped to protect the session.',
                    'warn'
                );

                log(
                    state.rateLimitMessage || e.message,
                    'warn'
                );

                log(
                    '=== SCAN STOPPED — INSTAGRAM RATE LIMITED ===',
                    'warn'
                );
            }
            else if (
                e?.code === 'IG_API_UNHEALTHY' ||
                state.apiUnhealthy
            ) {
                state.cancelled = true;
                state.scanComplete = false;
                state.scanOutcome = 'API_UNHEALTHY';

                status(
                    'Instagram API returned an invalid response: scan stopped without downloading.',
                    'warn'
                );

                log(
                    state.apiUnhealthyMessage || e.message,
                    'warn'
                );

                log(
                    '=== SCAN STOPPED — INSTAGRAM API UNHEALTHY ===',
                    'warn'
                );
            }
            else if (e.message === 'Cancelled') {
                state.scanComplete = false;
                state.scanOutcome = 'CANCELLED';

                status(
                    'Cancelled.',
                    'cancel'
                );

                log('=== SCAN CANCELLED ===', 'cancel');
            }
            else {
                state.scanComplete = false;
                state.scanOutcome = 'FAILED';

                status(
                    e.message,
                    'error'
                );

                log(
                    e.message,
                    'error'
                );

                log('=== SCAN FAILED ===', 'error');
            }
        }
        finally {
            state.running = false;
            disable(false);
            updateStats();
        }
    }

    function indexFolder(files) {
        state.diskCanonical.clear();
        state.diskCanonicalMeta.clear();
        state.diskLocations.clear();
        state.diskPaths.clear();
        state.sessionPaths.clear();
        state.sessionCategories.clear();
        state.highlightRenameNotices.clear();
        state.diskHidden.clear();
        state.diskStoryHighlight.clear();
        state.legacy.clear();
        const counts = {
            selectedFiles: files.length,
            canonicalFiles: 0,
            legacyFiles: 0,
            unrecognizedFiles: 0,
        };


        const canonical =
            /\s-\s(?:POST|REEL|STORY|HIGHLIGHT|TAGGED|AVATAR)\s-\s\d{4}_\d{2}_\d{2}\s-\s([A-Za-z0-9_]+)\.(jpg|jpeg|png|webp|mp4|m4v|mov)$/i;

        const legacy =
            /^([A-Za-z0-9._]+)-(photo|video|reels|stories|highlights|avatar)-([A-Za-z0-9_-]+)-(\d{8})_(\d{6})[_-](.+)\.(jpg|jpeg|png|webp|mp4|m4a|mov)$/i;

        for (
            const f
            of files
        ) {
            let m =
                f.name.match(
                    canonical
                );

            if (m) {
                counts.canonicalFiles++;
                const relativePath =
                    String(
                        f.webkitRelativePath ||
                        f.name ||
                        ''
                    )
                        .replace(
                            /\\/g,
                            '/'
                        );

                const canonicalType =
                    String(
                        f.name.match(
                            /\s-\s(POST|REEL|STORY|HIGHLIGHT|TAGGED|AVATAR)\s-\s/i
                        )?.[1] ||
                        ''
                    )
                        .toUpperCase();

                const folder = String(
                    relativePath.match(
                        /(?:^|\/)(?:[^/]*\s-\s)?(FAN CLUB|HIDDEN|POSTS|REELS|STORIES|HIGHLIGHTS|TAGGED|AVATAR)(?:\/|$)/i
                    )?.[1] || ''
                ).toUpperCase();

                const id = String(m[1]);
                state.diskCanonical.add(id);
                const paths = state.diskPaths.get(id) || new Set();
                paths.add(relativePath);
                state.diskPaths.set(id, paths);
                if (folder) {
                    const locations = state.diskLocations.get(id) || new Set();
                    locations.add(folder);
                    state.diskLocations.set(id, locations);
                }
                if (folder === 'HIDDEN') {
                    // Existing HIDDEN files are preserved, never deleted.
                    state.diskHidden.add(id);
                }

                // Keep canonical structure evidence without treating a
                // HIDDEN legacy copy as a different physical media ID.
                if (!state.diskCanonicalMeta.has(id) || folder !== 'HIDDEN') {
                    state.diskCanonicalMeta.set(id, {
                        type: canonicalType,
                        ext: String(m[2] || '').toLowerCase(),
                        name: String(f.name || ''),
                        folder,
                    });
                }

                continue;
            }

            m =
                f.name.match(
                    legacy
                );

            if (!m) {
                counts.unrecognizedFiles++;
                continue;
            }

            counts.legacyFiles++;

            const rec = {
                name: f.name,
                lower:
                    f.name.toLowerCase(),
                source:
                    m[2].toLowerCase(),
            };

            const legacyKey =
                [
                    'photo',
                    'video',
                    'reels',
                ].includes(rec.source)
                    ? (
                        canonicalShortcode(m[3]) ||
                        m[3]
                    )
                    : m[3];

            if (
                !state.legacy.has(
                    legacyKey
                )
            ) {
                state.legacy.set(
                    legacyKey,
                    []
                );
            }

            state.legacy
                .get(legacyKey)
                .push(rec);

            if (
                [
                    'stories',
                    'highlights',
                ].includes(
                    rec.source
                ) &&
                /^\d{10,}$/.test(
                    m[3]
                )
            ) {
                state
                    .diskStoryHighlight
                    .add(m[3]);
            }
        }

        state.diskIndexStats = counts;
        state.diskActive = true;
        reportHighlightFolderRenames();

        updateStats();

        status(
            `Local folder indexed: ${counts.selectedFiles} files, ` +
            `${state.diskCanonical.size} canonical IDs, ` +
            `${state.diskHidden.size} HIDDEN files, ` +
            `${state.legacy.size} legacy groups, ` +
            `${counts.unrecognizedFiles} unrecognized. ` +
            `Names indexed; file content not checked.`,
            'ok'
        );

        log(
            `Local archive indexed: ` +
            `${files.length} files, ` +
            `${state.diskCanonical.size} canonical IDs, ` +
            `${state.diskHidden.size} HIDDEN-folder files, ` +
            `${state.legacy.size} legacy groups.`
        );


        log(
            'Local archive is historical: extra files are preserved even if the corresponding Instagram media was later deleted.'
        );
    }

    function legacyMatch(m) {
        if (!state.diskActive) {
            return false;
        }

        if (
            state
                .diskStoryHighlight
                .has(
                    String(m.id)
                )
        ) {
            return true;
        }

        if (!m.shortcode) {
            return false;
        }

        const files =
            state.legacy.get(
                m.shortcode
            ) ||
            [];

        if (!files.length) {
            return false;
        }

        if (
            m.originalToken &&
            m.originalToken.length >= 5 &&
            files.some(
                f =>
                    f.lower.includes(
                        m.originalToken
                    )
            )
        ) {
            return true;
        }

        /*
         * Safe by shortcode only if not a carousel.
         */
        return m.rootCount === 1;
    }

    function existingReason(m) {
        if (
            state.settings.force
        ) {
            return null;
        }

        const id =
            String(m.id);
        const category = mediaArchiveCategory(m);
        // A GM_download onload is a receipt, not a re-index of saved files.
        // A HIGHLIGHT additionally requires an exact accepted reel directory.
        const sessionAccepted = state.sessionCategories?.get(id)?.has(category) === true &&
            (m.type !== 'HIGHLIGHT' ||
                [...(state.sessionPaths.get(id) || [])]
                    .some(path => matchesHighlightArchivePath(m,path)));

        if (state.diskActive) {
            if (state.diskLocations.get(id)?.has(mediaArchiveCategory(m))) {
                // Matching type and ID are insufficient for highlights:
                // the actual indexed reel directory must also match.
                if (m.type !== 'HIGHLIGHT') return 'DISK';
                if (
                    [...(state.diskPaths.get(id) || [])]
                        .some(p => matchesHighlightArchivePath(m, p))
                ) return 'DISK';

                // Newly repaired files are not part of the *old* directory
                // scan. Honor this session's accepted requested path to
                // avoid downloading them twice before the next re-index.
                if (
                    [...(state.sessionPaths.get(id) || [])]
                        .some(p => matchesHighlightArchivePath(m, p))
                ) return 'SESSION';
            }

            if (sessionAccepted) return 'SESSION';

            // Legacy matches have no reliable visibility information.
            // Never mistake an old POSTS/HIDDEN copy for a FAN CLUB file.
            if (
                !['FAN CLUB', 'HIDDEN', 'HIGHLIGHTS'].includes(mediaArchiveCategory(m)) &&
                legacyMatch(m)
            ) {
                return 'LEGACY';
            }

            return null;
        }

        // A successful session callback avoids duplicate transfers only
        // during this page session; it is NOT a read-back of the file.
        return sessionAccepted ? 'SESSION' : null;
    }

    function unverifiedArchiveHistory(mediaRecords = state.queue.values()) {
        const result = {
            total: 0,
            ledger: 0,
        };

        if (
            state.settings.force ||
            state.diskActive
        ) {
            return result;
        }

        for (
            const m
            of mediaRecords
        ) {
            const id =
                String(m.id);

            // Only a real folder index or an accepted same-category
            // session receipt can account for this historical ledger item.
            if (existingReason(m) === 'SESSION') {
                continue;
            }

            if (
                ledgerHas(id)
            ) {
                result.ledger++;
                result.total++;
            }
        }

        return result;
    }

    function downloadAttempt(
        m,
        options = {}
    ) {
        return new Promise(
            (resolve, reject) => {
                const path =
                    archiveDownloadPath(
                        m,
                        state.username,
                        options
                    );

                const fail =
                    message => {
                        const e =
                            new Error(
                                message ||
                                'download failed'
                            );

                        e.downloadPath =
                            path;

                        reject(e);
                    };

                try {
                    GM_download({
                        url: m.url,

                        name:
                            path,

                        saveAs:
                            false,

                        conflictAction:
                            'overwrite',

                        headers: {
                            Referer:
                                'https://www.instagram.com/',
                        },

                        onload:
                            () => resolve({ requestedPath: path }),

                        onerror:
                            e => fail(
                                e?.error ||
                                e?.details ||
                                'download failed'
                            ),

                        ontimeout:
                            () => fail(
                                'timeout'
                            ),
                    });
                }

                catch (e) {
                    e.downloadPath ||=
                        path;

                    reject(e);
                }
            }
        );
    }

    async function downloadMainOne(m) {
        if (
            existingReason(m)
        ) {
            return true;
        }

        const startedAt = performance.now();
        let last = null;
        let safeHighlightFallback = false;

        for (
            let attempt = 1;
            attempt <= APP.DOWNLOAD_RETRIES;
            attempt++
        ) {
            if (state.cancelled) {
                return false;
            }

            try {
                const receipt = await downloadAttempt(
                    m,
                    { safeHighlightFallback }
                );

                recordDownloaded(m, receipt.requestedPath);

                // Never modify the folder-indexed Sets or metadata from
                // an onload callback; Firefox may save at a different path.
                const mediaId = String(m.id);
                const accepted = state.sessionCategories.get(mediaId) || new Set();
                accepted.add(mediaArchiveCategory(m));
                state.sessionCategories.set(mediaId,accepted);
                const sessionPaths = state.sessionPaths.get(mediaId) || new Set();
                sessionPaths.add(receipt.requestedPath);
                state.sessionPaths.set(mediaId,sessionPaths);

                state.downloaded++;

                markDownloadOperation(
                    true,
                    m,
                    String(m.type || 'MEDIA')
                );

                const elapsed =
                    (performance.now() - startedAt) / 1000;

                log(
                    `✓ ${m.filename} — ${elapsed.toFixed(2)} s`
                );

                updateStats();

                return true;
            }

            catch (e) {
                last = e;

                const illegalPath =
                    /filename must not contain illegal characters|illegal filename|invalid filename/i.test(
                        String(
                            e?.message ||
                            ''
                        )
                    );

                if (
                    illegalPath &&
                    m?.type === 'HIGHLIGHT' &&
                    !safeHighlightFallback &&
                    attempt <
                        APP.DOWNLOAD_RETRIES
                ) {
                    safeHighlightFallback = true;

                    log(
                        `↻ ${m.filename} — Highlight folder rejected; ` +
                        `retrying with safe folder ` +
                        `"${highlightFallbackFolderTitle(m)}".`,
                        'warn'
                    );

                    continue;
                }

                if (illegalPath) {
                    log(
                        `Download path rejected: "${e?.downloadPath || archiveDownloadPath(m)}".`,
                        'warn'
                    );

                    break;
                }

                if (
                    attempt <
                    APP.DOWNLOAD_RETRIES
                ) {
                    const wait =
                        700 * attempt +
                        rand(150, 650);

                    log(
                        `↻ ${m.filename} — retry ` +
                        `${attempt + 1}/${APP.DOWNLOAD_RETRIES} ` +
                        `after ${e.message}`,
                        'warn'
                    );

                    await sleep(wait);
                }
            }
        }

        state.failed++;

        markDownloadOperation(
            false,
            m,
            String(m.type || 'MEDIA')
        );

        const elapsed =
            (performance.now() - startedAt) / 1000;

        log(
            `✗ ${m.filename} — ` +
            `${last?.message || 'download failed after retries'} ` +
            `(${elapsed.toFixed(2)} s)`,
            'error'
        );

        updateStats();

        return false;
    }

    async function downloadOne(m) {
        return existingReason(m) ? true : downloadMainOne(m);
    }
    function diagnosticDownloadPath(m, index) {
        const user = sanitize(
            state.username ||
            'instagram'
        );

        const number = String(index + 1)
            .padStart(2, '0');

        return [
            user,
            `${user} - DIAG`,
            `${number} - ${m.filename}`,
        ].join('/');
    }

    async function diagnosticHttpFetch(m) {
        const startedAt = performance.now();

        const r = await gmRequest({
            method: 'GET',
            url: m.url,
            responseType: 'arraybuffer',
            headers: {
                Accept: '*/*',
                Referer: 'https://www.instagram.com/',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
            },
        });

        const statusCode = Number(r?.status || 0);

        if (
            statusCode < 200 ||
            statusCode >= 300
        ) {
            throw new Error(
                `HTTP ${statusCode || '?'}`
            );
        }

        const elapsedMs =
            performance.now() - startedAt;

        let bytes = 0;

        if (
            r?.response &&
            Number.isFinite(
                r.response.byteLength
            )
        ) {
            bytes = Number(
                r.response.byteLength
            );
        }

        if (!bytes) {
            const match = String(
                r?.responseHeaders || ''
            ).match(
                /^content-length:\s*(\d+)/im
            );

            if (match) {
                bytes = Number(match[1]);
            }
        }

        return {
            elapsedMs,
            bytes,
            statusCode,
        };
    }

    function diagnosticGmDownload(m, index) {
        return new Promise(
            (resolve, reject) => {
                const startedAt = performance.now();

                try {
                    GM_download({
                        url: m.url,
                        name:
                            diagnosticDownloadPath(
                                m,
                                index
                            ),
                        saveAs: false,
                        conflictAction: 'overwrite',
                        headers: {
                            Referer:
                                'https://www.instagram.com/',
                        },
                        onload: () => resolve({
                            elapsedMs:
                                performance.now() -
                                startedAt,
                        }),
                        onerror: e => reject(
                            new Error(
                                e?.error ||
                                e?.details ||
                                'GM_download failed'
                            )
                        ),
                        ontimeout: () => reject(
                            new Error(
                                'GM_download timeout'
                            )
                        ),
                    });
                }
                catch (e) {
                    reject(e);
                }
            }
        );
    }

    async function diagnosticHeadProbe(m) {
        const startedAt = performance.now();

        const r = await gmRequest({
            method: 'HEAD',
            url: m.url,
            headers: {
                Accept: '*/*',
                Referer: 'https://www.instagram.com/',
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
            },
        });

        const statusCode = Number(r?.status || 0);

        if (
            statusCode < 200 ||
            statusCode >= 400
        ) {
            throw new Error(
                `HTTP ${statusCode || '?'}`
            );
        }

        let bytes = 0;

        const match = String(
            r?.responseHeaders || ''
        ).match(
            /^content-length:\s*(\d+)/im
        );

        if (match) {
            bytes = Number(match[1]);
        }

        return {
            elapsedMs:
                performance.now() - startedAt,
            bytes,
            statusCode,
        };
    }

    function splitDiagnosticGroups(probed) {
        const sorted = [...probed].sort(
            (a, b) =>
                (a.bytes || 0) -
                (b.bytes || 0)
        );

        const http = [];
        const gm = [];
        let httpBytes = 0;
        let gmBytes = 0;

        for (
            let i = 0;
            i < sorted.length;
            i += 2
        ) {
            const pair = sorted.slice(i, i + 2);

            if (pair.length === 1) {
                if (http.length <= gm.length) {
                    http.push(pair[0]);
                    httpBytes += pair[0].bytes || 0;
                }
                else {
                    gm.push(pair[0]);
                    gmBytes += pair[0].bytes || 0;
                }

                continue;
            }

            const [a, b] = pair;

            if (httpBytes <= gmBytes) {
                http.push(b);
                gm.push(a);
                httpBytes += b.bytes || 0;
                gmBytes += a.bytes || 0;
            }
            else {
                http.push(a);
                gm.push(b);
                httpBytes += a.bytes || 0;
                gmBytes += b.bytes || 0;
            }
        }

        return {
            http,
            gm,
            httpBytes,
            gmBytes,
        };
    }

    async function runDownloadDiagnostic() {
        if (
            state.running ||
            state.downloading
        ) {
            status(
                'Wait for the current operation to finish.',
                'warn'
            );

            return;
        }

        if (
            state.feedbackRequired ||
            state.rateLimited ||
            state.apiUnhealthy
        ) {
            const stopReason = state.feedbackRequired
                ? 'feedback_required'
                : state.rateLimited
                    ? 'HTTP 429'
                    : 'an invalid API response';

            status(
                `DL diagnostic blocked after ${stopReason} in this session.`,
                'warn'
            );
            return;
        }

        if (!state.queue.size) {
            status(
                'Run SCAN first.',
                'warn'
            );

            return;
        }

        const candidates =
            [...state.queue.values()]
                .filter(
                    m =>
                        m?.url &&
                        /\.(?:jpe?g|png|webp)$/i
                            .test(
                                String(
                                    m.filename || ''
                                )
                            )
                )
                .slice(
                    0,
                    APP.DL_DIAG_SAMPLES
                );

        if (candidates.length < 4) {
            status(
                'DL diagnostic: not enough image candidates in the current scan.',
                'warn'
            );

            return;
        }

        state.downloading = true;
        state.cancelled = false;
        disable(true);

        try {
            log(
                `=== DL DIAGNOSTIC v1.5.10 START — ${candidates.length} distinct images ===`
            );
            log(
                'Phase 0: HEAD only to estimate sizes; no image body is downloaded.'
            );

            const probed = [];

            for (
                let i = 0;
                i < candidates.length;
                i++
            ) {
                if (state.cancelled) {
                    break;
                }

                const m = candidates[i];

                try {
                    const r =
                        await diagnosticHeadProbe(m);

                    probed.push({
                        media: m,
                        bytes: r.bytes,
                    });

                    log(
                        `HEAD ${i + 1}/${candidates.length} ` +
                        `${m.filename}` +
                        (r.bytes
                            ? ` — ${(r.bytes / (1024 * 1024)).toFixed(2)} MB`
                            : ' — size unavailable')
                    );
                }
                catch (e) {
                    probed.push({
                        media: m,
                        bytes: 0,
                    });

                    log(
                        `HEAD ${i + 1}/${candidates.length} ` +
                        `${m.filename} — size probe failed: ${e.message}`,
                        'warn'
                    );
                }
            }

            if (state.cancelled) {
                status(
                    'DL diagnostic cancelled during HEAD phase.',
                    'cancel'
                );

                return;
            }

            const groups =
                splitDiagnosticGroups(probed);

            const mb = bytes =>
                bytes / (1024 * 1024);

            log(
                `Balanced distinct groups: HTTP=${groups.http.length} images / ` +
                `${mb(groups.httpBytes).toFixed(2)} MB estimated, ` +
                `GM_download=${groups.gm.length} images / ` +
                `${mb(groups.gmBytes).toFixed(2)} MB estimated.`
            );
            log(
                'IMPORTANT: no URL is tested by both methods, preventing the HTTP phase from warming the GM_download body cache.'
            );

            let httpOk = 0;
            let gmOk = 0;
            let httpTotalMs = 0;
            let gmTotalMs = 0;
            let httpBytes = 0;
            let gmBytes = 0;

            log(
                'Phase A: full HTTP GET into memory on group A only.'
            );

            for (
                let i = 0;
                i < groups.http.length;
                i++
            ) {
                if (state.cancelled) {
                    break;
                }

                const item = groups.http[i];
                const m = item.media;

                try {
                    const r =
                        await diagnosticHttpFetch(m);

                    httpOk++;
                    httpTotalMs += r.elapsedMs;
                    httpBytes += r.bytes;

                    const sizeMb = mb(r.bytes);
                    const seconds = r.elapsedMs / 1000;
                    const rate =
                        seconds > 0
                            ? sizeMb / seconds
                            : 0;

                    log(
                        `HTTP ${i + 1}/${groups.http.length} ` +
                        `${m.filename} — ${seconds.toFixed(2)} s` +
                        (r.bytes
                            ? ` — ${sizeMb.toFixed(2)} MB — ${rate.toFixed(2)} MB/s`
                            : '')
                    );
                }
                catch (e) {
                    log(
                        `HTTP ${i + 1}/${groups.http.length} ` +
                        `${m.filename} — FAILED: ${e.message}`,
                        'error'
                    );
                }
            }

            if (state.cancelled) {
                status(
                    'DL diagnostic cancelled during HTTP phase.',
                    'cancel'
                );

                return;
            }

            log(
                'Phase B: GM_download on the separate group B only.'
            );

            for (
                let i = 0;
                i < groups.gm.length;
                i++
            ) {
                if (state.cancelled) {
                    break;
                }

                const item = groups.gm[i];
                const m = item.media;

                try {
                    const r =
                        await diagnosticGmDownload(
                            m,
                            i
                        );

                    gmOk++;
                    gmTotalMs += r.elapsedMs;
                    gmBytes += item.bytes || 0;

                    const seconds = r.elapsedMs / 1000;
                    const sizeMb = mb(item.bytes || 0);
                    const rate =
                        seconds > 0 && item.bytes
                            ? sizeMb / seconds
                            : 0;

                    log(
                        `GM   ${i + 1}/${groups.gm.length} ` +
                        `${m.filename} — ${seconds.toFixed(2)} s` +
                        (item.bytes
                            ? ` — ~${sizeMb.toFixed(2)} MB — ~${rate.toFixed(2)} MB/s`
                            : '')
                    );
                }
                catch (e) {
                    log(
                        `GM   ${i + 1}/${groups.gm.length} ` +
                        `${m.filename} — FAILED: ${e.message}`,
                        'error'
                    );
                }
            }

            if (state.cancelled) {
                status(
                    'DL diagnostic cancelled during GM_download phase.',
                    'cancel'
                );

                return;
            }

            const httpAvg =
                httpOk
                    ? httpTotalMs / httpOk
                    : 0;
            const gmAvg =
                gmOk
                    ? gmTotalMs / gmOk
                    : 0;

            const httpRate =
                httpTotalMs > 0 && httpBytes
                    ? mb(httpBytes) /
                      (httpTotalMs / 1000)
                    : 0;

            const gmRate =
                gmTotalMs > 0 && gmBytes
                    ? mb(gmBytes) /
                      (gmTotalMs / 1000)
                    : 0;

            log(
                `=== DL DIAGNOSTIC RESULT — HTTP ${httpOk}/${groups.http.length}: ` +
                `${(httpAvg / 1000).toFixed(2)} s avg` +
                (httpRate
                    ? `, ${httpRate.toFixed(2)} MB/s`
                    : '') +
                ` | GM_download ${gmOk}/${groups.gm.length}: ` +
                `${(gmAvg / 1000).toFixed(2)} s avg` +
                (gmRate
                    ? `, ~${gmRate.toFixed(2)} MB/s`
                    : '') +
                ` ===`
            );

            if (
                httpOk &&
                gmOk
            ) {
                const ratio =
                    gmAvg /
                    Math.max(httpAvg, 1);

                log(
                    `DL diagnostic ratio (distinct matched groups): ` +
                    `GM_download / HTTP = ${ratio.toFixed(2)}x.`
                );
            }

            status(
                `DL diagnostic complete: HTTP ` +
                `${(httpAvg / 1000).toFixed(2)} s avg, ` +
                `GM_download ${(gmAvg / 1000).toFixed(2)} s avg.`,
                (httpOk === groups.http.length &&
                 gmOk === groups.gm.length)
                    ? 'ok'
                    : 'warn'
            );
        }
        finally {
            state.downloading = false;
            disable(false);
            updateStats();
        }
    }

    async function downloadMissing(mode = DOWNLOAD_MODE.COMPLETE) {
        if (
            state.running ||
            state.downloading
        ) {
            return;
        }

        if (
            !state.queue.size
        ) {
            status(
                'Run SCAN first.',
                'warn'
            );

            return;
        }

        // Every download must resolve one explicit, evidence-bounded scope.
        // Invalid or unknown modes fail closed.
        const scanIntegrity = authorizeDownloadScope(mode);

        if (!scanIntegrity.ok) {
            status(
                `Download blocked: ${scanIntegrity.reason}.`,
                'warn'
            );
            log(
                `Archive guard blocked ${DOWNLOAD_MODE_LABEL[mode] || mode} download: ` +
                `${scanIntegrity.reason}.`,
                'warn'
            );
            return;
        }

        const mediaScope = scanIntegrity.media;
        const isPartial = mode !== DOWNLOAD_MODE.COMPLETE;

        // GM_download reports successful transfers, not whether Firefox
        // actually created the requested nested directories.
        if (mediaScope.some(m => m.type === 'HIGHLIGHT')) {
            const downloadMode = typeof GM_info !== 'undefined'
                ? String(GM_info?.downloadMode || '')
                : '';
            if (downloadMode && downloadMode !== 'browser') {
                log(
                    'Tampermonkey Download Mode=' + downloadMode +
                    ': nested HIGHLIGHT directories are not guaranteed. ' +
                    'Use Browser API mode and verify with SCAN LOCAL FOLDER.',
                    'warn'
                );
            }
        }

        const unverified =
            unverifiedArchiveHistory(mediaScope);

        if (unverified.total) {
            status(
                `Download blocked: ${unverified.total} historical records are not verified on disk. ` +
                `Run SCAN LOCAL FOLDER first.`,
                'warn'
            );

            log(
                `Archive guard: ${unverified.total} media are known only from persisted ledger history ` +
                `(ledger=${unverified.ledger}). ` +
                `Ledger history is advisory until SCAN LOCAL FOLDER verifies the archive.`,
                'warn'
            );

            return;
        }

        state.downloading = true;
        state.cancelled = false;

        disable(true);

        try {
            const pending =
                mediaScope
                    .filter(m => !existingReason(m));

            const downloadPlan =
                beginDownloadProgress(
                    pending
                );

            if (!pending.length) {
                const diskMatched = mediaScope.filter(m =>
                    existingReason(m) === 'DISK').length;
                const acceptedSession = mediaScope.filter(m =>
                    existingReason(m) === 'SESSION').length;
                const legacyMatched = mediaScope.filter(m =>
                    existingReason(m) === 'LEGACY').length;

                const message =
                    `No media pending in ${DOWNLOAD_MODE_LABEL[mode]}: ` +
                    `${mediaScope.length} scanned, ${diskMatched} folder-indexed, ` +
                    `${acceptedSession} GM_download session receipts, ` +
                    `${legacyMatched} legacy filename matches. ` +
                    `Session receipts are not disk verification.` +
                    (isPartial ? ' PROFILE scan remains INCOMPLETE.' : '');

                log(message);
                status(message, 'ok');

                return;
            }

            const workerCount = Math.min(
                APP.DOWNLOAD_WORKERS,
                pending.length
            );

            let next = 0;
            let completed = 0;
            const batchStartedAt = performance.now();

            log(
                `${mode === DOWNLOAD_MODE.COMPLETE ? 'Starting download' : 'Starting ' + DOWNLOAD_MODE_LABEL[mode] + ' download'}: ` +
                `${pending.length} media jobs, ` +
                `${downloadPlan.total} physical writes (one per media), ` +
                `${workerCount} worker, ` +
                `${APP.DOWNLOAD_RETRIES} attempts max per file, ` +
                `inter-file delay=${APP.DOWNLOAD_DELAY} ms.`
            );

            const worker = async workerId => {
                if (workerId > 0) {
                    await sleep(
                        workerId *
                        APP.DOWNLOAD_DELAY
                    );
                }

                while (true) {
                    if (state.cancelled) {
                        return;
                    }

                    const index = next++;

                    if (index >= pending.length) {
                        return;
                    }

                    const media = pending[index];

                    await downloadOne(
                        media
                    );

                    completed++;

                    status(
                        `Downloading ${completed}/${pending.length} — ` +
                        `${workerCount} parallel workers`
                    );

                    if (
                        next < pending.length
                    ) {
                        await sleep(
                            APP.DOWNLOAD_DELAY
                        );
                    }
                }
            };

            await Promise.all(
                Array.from(
                    { length: workerCount },
                    (_, workerId) => worker(workerId)
                )
            );

            if (state.cancelled) {
                state.downloadProgress.status =
                    'cancelled';
                state.downloadProgress.current = '';
                updateStats();

                status(
                    `Download cancelled: ${completed}/${pending.length} media jobs processed.`,
                    'cancel'
                );

                return;
            }

            state.downloadProgress.status =
                'complete';
            state.downloadProgress.current = '';
            updateStats();

            const batchElapsed =
                (performance.now() - batchStartedAt) / 1000;
            const average =
                completed
                    ? batchElapsed / completed
                    : 0;

            const p = state.downloadProgress;
            const summary =
                `${DOWNLOAD_MODE_LABEL[mode]} finished: ` +
                `${completed} media jobs processed, ` +
                `${p.succeeded}/${downloadPlan.total} GM_download success callbacks (disk not independently verified), ` +
                `${p.failed} failed, ${p.blocked} blocked; ` +
                `${batchElapsed.toFixed(2)} s, ${average.toFixed(2)} s/job.` +
                (isPartial ? ' Overall PROFILE scan remains INCOMPLETE.' : '');

            log(summary, p.failed || p.blocked || isPartial ? 'warn' : 'info');
            status(summary, p.failed || p.blocked || isPartial ? 'warn' : 'ok');
        }

        finally {
            try {
                flushLedger(true);
            }
            catch (e) {
                log(
                    `Final ledger flush failed: ${e.message}`,
                    'error'
                );
            }

            state.downloading = false;

            disable(false);

            updateStats();
        }
    }

    async function syncAll() {
        await scanAll();

        if (
            state.cancelled
        ) {
            return;
        }

        const scanIntegrity = completedScanIntegrity();

        if (!scanIntegrity.ok) {
            status(
                `SCAN + DOWNLOAD stopped: ${scanIntegrity.reason}.`,
                'warn'
            );

            return;
        }

        await downloadMissing();
    }

    function profileSourceDiagnosticSnapshot() {
        // Read-only evidence. Main PROFILE is captured before visiting
        // independent REELS; DOM links remain candidates, never proof.
        const key = String(state.username || '').toLowerCase();
        const publicRoots = state.shadow?.rootIds instanceof Set
            ? state.shadow.rootIds : new Set();
        const nativeMap = net.gridByUser?.get(key);
        const nativeRoots = nativeMap instanceof Map
            ? new Set(nativeMap.keys()) : new Set();
        const domCandidates = state.profileDomObservedRootIds instanceof Set
            ? state.profileDomObservedRootIds : new Set();
        const mainRoots = state.profileMainGridRootIds instanceof Set
            ? state.profileMainGridRootIds : new Set();
        const reelMap = net.reelsByUserId?.get(String(state.userId || ''));
        const reelRoots = reelMap instanceof Map
            ? new Set(reelMap.keys()) : new Set();
        const valid = id => /^\d+$/.test(String(id));
        const list = xs => [...xs].map(String).filter(valid).sort();
        const pub = new Set(list(publicRoots));
        const nat = new Set(list(nativeRoots));
        const dom = new Set(list(domCandidates));
        const main = new Set(list(mainRoots));
        const reels = new Set(list(reelRoots));
        const publicNative = new Set([...pub, ...nat]);
        const withDom = new Set([...publicNative, ...dom]);
        const expected = Number(state.profileInfo?.media_count);
        const expectedVerified = Number.isSafeInteger(expected) &&
            expected >= 0 && expected === Number(state.expected);
        const expectedCount = expectedVerified ? expected : null;
        const overlap = (a,b) => [...a].filter(id => b.has(id)).length;
        const nativeAudit = net.gridNativeAuditByUser?.get(key);
        const nativePage = net.gridPageInfo?.get(key);
        return {
            kind:'PROFILE_SOURCE_DIAGNOSTICS_ONLY',
            account:key,
            userId:String(state.userId || ''),
            expectedAuthenticated:expectedCount,
            publicServerEnded:state.shadow?.pageInfoEnded === true &&
                state.coverage?.publicShadow === true,
            nativeServerEnded:nativePage?.has_next_page === false &&
                nativeAudit?.lastHasNext === 'false',
            counts:{
                public:pub.size,
                native:nat.size,
                domCandidates:dom.size,
                mainGridSnapshot:main.size,
                independentNativeReels:reels.size,
                publicNativeUnion:publicNative.size,
                publicNativeOverlap:overlap(pub,nat),
                mainOutsidePublicNative:
                    [...main].filter(id=>!publicNative.has(id)).length,
                mainAlsoSeenInDom:overlap(main,dom),
                mainAlsoInIndependentReels:overlap(main,reels),
                observedUnionIncludingDomCandidates:withDom.size,
                gapMainVsCounter:expectedCount == null
                    ? null : Math.max(0,expectedCount-main.size),
                gapPublicNativeVsCounter:expectedCount == null
                    ? null : Math.max(0,expectedCount-publicNative.size),
            },
            rootIds:{
                public:list(pub),
                native:list(nat),
                domCandidates:list(dom),
                mainGridSnapshot:list(main),
                independentNativeReels:list(reels),
            },
            warning:'Diagnostic only: DOM candidates, independent REELS ' +
                'and Instagram counters do not establish missing PROFILE ' +
                'identities or authorize more downloads.',
        };
    }

    function exportManifest() {
        if (
            !state.userId
        ) {
            status(
                'Scan a profile first.',
                'warn'
            );

            return;
        }

        const db =
            loadDb();

        const records = {};

        for (
            const [id, m]
            of state.queue
        ) {
            records[id] = {
                id,
                filename:
                    m.filename,
                type:
                    m.type,
                timestamp:
                    m.timestamp ||
                    null,
                shortcode:
                    m.shortcode ||
                    null,
                sources:
                    [...m.sources],
                visibility: m.visibility || null,
                archiveCategory: mediaArchiveCategory(m),
                highlightId: m.highlightId || null,
                highlightIds: m.highlightIds instanceof Set
                    ? [...m.highlightIds].sort() : [],
                requestedPath: archiveDownloadPath(m),
                hidden:
                    isHiddenMedia(m),
                hiddenDiscovery:
                    hiddenDiscoverySources(m),
            };
        }

        const payload = {
            format:
                'JKL_IG_BACKUP_MANIFEST',

            version: 1,

            generatedAt:
                new Date()
                    .toISOString(),

            username:
                state.username,

            userId:
                state.userId,

            diagnostics: {
                globalMediaCount: state.expected || null,
                accessibleOwnedRoots: ownedCount(),
                globalGap: globalGap(),
                profileSourceDiagnostics: profileSourceDiagnosticSnapshot(),
                publicShadow: { ...state.shadow },
                connectedHidden: {
                    ...state.hidden,
                    recoveredCodes: [...state.hidden.recoveredCodes],
                },
                taggedCountHintMismatches:
                    (state.taggedCountHintMismatches || []).map(x => ({...x})),
                taggedCountHintFailures:
                    (state.taggedCountHintFailures || []).map(x => ({...x})),
                taggedHistoricalPostRestored:
                    Number(state.taggedHistoricalPostRestored || 0),
                taggedExplicitChildProbes:
                    (state.taggedExplicitChildProbes || []).map(x => ({...x})),
                hiddenArchive: {
                    media: hiddenMediaCount(),
                    filesOnDisk: state.diskHidden.size,
                    uniqueFilePolicy: true,
                },
                hydration: { ...state.hydration },
                coverage: { ...state.coverage },
                exclusive: { ...state.exclusive },
            },

            records,

            ledger:
                db
                    .profiles
                    ?.[state.userId]
                    ?.media ||
                {},
        };

        const blob =
            new Blob(
                [
                    JSON.stringify(
                        payload,
                        null,
                        2
                    ),
                ],
                {
                    type:
                        'application/json',
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const a =
            document.createElement(
                'a'
            );

        a.href = url;

        a.download =
            `${sanitize(state.username)} - Instagram Backup Manifest.json`;

        document.body
            .appendChild(a);

        a.click();
        a.remove();

        setTimeout(
            () =>
                URL.revokeObjectURL(
                    url
                ),
            5000
        );
    }

    function resetLedger() {
        if (state.running || state.downloading) {
            status(
                'Reset ledger unavailable during SCAN/DOWNLOAD.',
                'warn'
            );
            return;
        }

        if (
            !state.userId
        ) {
            status(
                'Scan a profile first.',
                'warn'
            );

            return;
        }

        if (
            !confirm(
                `Reset local history for ` +
                `@${state.username}? ` +
                `Files are NOT deleted.`
            )
        ) {
            return;
        }

        const db =
            loadDb();

        delete db.profiles[
            state.userId
        ];

        GM_setValue(
            APP.DB,
            db
        );

        state.dbCache = db;
        state.ledgerDirty = 0;

        updateStats();
    }

    function disable(b) {
        for (
            const k
            of [
                'scan',
                'download',
                'downloadAuthorized',
                'downloadAccessible',
                'sync',
                'username',
                'cbPost',
                'cbReel',
                'cbStory',
                'cbHighlight',
                'cbTagged',
                'cbAvatar',
                'force',
                'folder',
                'folderButton',
                'dlDiag',
                'exportManifest',
                'resetLedger',
            ]
        ) {
            if (ui[k]) {
                ui[k].disabled =
                    !!b;
            }
        }

        if (
            ui.cancel
        ) {
            ui.cancel.disabled =
                !b;
        }
    }

    function bind(
        el,
        key
    ) {
        el.checked =
            !!state.settings[key];

        el.addEventListener(
            'change',
            () => {
                state.settings[key] =
                    el.checked;

                if (
                    key.startsWith('include') &&
                    state.scanPlan &&
                    !state.running
                ) {
                    invalidateCompletedScan('SELECTION_CHANGED');
                    status(
                        'Category selection changed: run SCAN again before downloading.',
                        'warn'
                    );
                }

                saveSettings();

                if (!state.running) {
                    resetScanProgress(
                        currentScanSelection()
                    );
                    updateStats();
                }
            }
        );
    }

    function cancel() {
        state.cancelled = true;

        if (state.running) {
            state.scanComplete = false;
            state.scanOutcome = 'CANCELLED';
        }

        status(
            'Cancelling…',
            'warn'
        );
    }


    function loadUiState() {
        const raw = GM_getValue(UI_STATE_KEY, {});

        return (
            raw &&
            typeof raw === 'object'
        )
            ? raw
            : {};
    }

    function saveUiState(patch = {}) {
        const current = loadUiState();

        GM_setValue(
            UI_STATE_KEY,
            {
                ...current,
                ...patch,
            }
        );
    }
    function panelSafeBounds(
        viewport =
            panelViewportBounds()
    ) {
        const marginX =
            Math.max(
                0,
                Number(
                    APP.PANEL_MARGIN_X
                ) || 0
            );

        const marginY =
            Math.max(
                0,
                Number(
                    APP.PANEL_MARGIN_Y
                ) || 0
            );

        const left =
            viewport.left +
            marginX;

        const right =
            Math.max(
                left,
                viewport.right -
                marginX
            );

        const top =
            viewport.top +
            marginY;

        const bottom =
            Math.max(
                top,
                viewport.bottom -
                marginY
            );

        return {
            left,
            right,
            top,
            bottom,
            width:
                Math.max(
                    0,
                    right - left
                ),
            height:
                Math.max(
                    0,
                    bottom - top
                ),
        };
    }

    function panelHorizontalPosition(
        viewport,
        panelWidth,
        anchor = 'right',
        gapX = APP.PANEL_MARGIN_X
    ) {
        const safe =
            panelSafeBounds(
                viewport
            );

        const width =
            Math.min(
                Math.max(
                    0,
                    Number(panelWidth) ||
                    0
                ),
                safe.width
            );

        const gap =
            Math.max(
                Number(
                    APP.PANEL_MARGIN_X
                ) || 0,
                Number(gapX) || 0
            );

        const side =
            anchor === 'left'
                ? 'left'
                : 'right';

        const preferredLeft =
            side === 'left'
                ? viewport.left + gap
                : viewport.right -
                    gap -
                    width;

        const maxLeft =
            Math.max(
                safe.left,
                safe.right - width
            );

        const left =
            Math.min(
                Math.max(
                    preferredLeft,
                    safe.left
                ),
                maxLeft
            );

        return {
            left,
            width,
            anchor: side,
            gapX:
                side === 'left'
                    ? left -
                        viewport.left
                    : viewport.right -
                        (
                            left +
                            width
                        ),
        };
    }

    function fitPanelToViewport(box) {
        if (!box) {
            return;
        }

        const body =
            box.querySelector('.body');

        if (!body) {
            return;
        }

        const viewport =
            panelViewportBounds();

        const safe =
            panelSafeBounds(
                viewport
            );

        box.style.maxWidth =
            `${Math.max(
                1,
                safe.width
            )}px`;

        if (
            box.classList.contains(
                'mini'
            )
        ) {
            body.style.maxHeight = '';
            return;
        }

        const rect =
            box.getBoundingClientRect();

        const header =
            box.querySelector('header');

        const headerHeight =
            Math.max(
                0,
                Number(
                    header
                        ?.getBoundingClientRect()
                        ?.height ||
                    0
                )
            );

        const available =
            Math.max(
                0,
                safe.bottom -
                    Math.max(
                        safe.top,
                        rect.top
                    ) -
                    headerHeight
            );

        body.style.maxHeight =
            `${available}px`;
    }
    function panelViewportBounds() {
        const vv =
            window.visualViewport;

        const left =
            Math.max(
                0,
                Number(vv?.offsetLeft) || 0
            );

        const top =
            Math.max(
                0,
                Number(vv?.offsetTop) || 0
            );

        const width =
            Math.max(
                0,
                Number(vv?.width) ||
                window.innerWidth ||
                document.documentElement
                    ?.clientWidth ||
                0
            );

        const height =
            Math.max(
                0,
                Number(vv?.height) ||
                window.innerHeight ||
                document.documentElement
                    ?.clientHeight ||
                0
            );

        return {
            left,
            top,
            width,
            height,
            right: left + width,
            bottom: top + height,
        };
    }
    function clampPanelPosition(
        box,
        left,
        top
    ) {
        const rect =
            box.getBoundingClientRect();

        const viewport =
            panelViewportBounds();

        const safe =
            panelSafeBounds(
                viewport
            );

        const width =
            Math.min(
                rect.width,
                safe.width
            );

        const maxLeft =
            Math.max(
                safe.left,
                safe.right -
                    width
            );

        const headerHeight =
            Math.max(
                36,
                Number(
                    box.querySelector('header')
                        ?.getBoundingClientRect()
                        ?.height ||
                    0
                )
            );

        const minVisibleHeight =
            box.classList.contains('mini')
                ? Math.min(
                    44,
                    rect.height
                )
                : Math.min(
                    rect.height,
                    headerHeight + 120
                );

        const maxTop =
            Math.max(
                safe.top,
                safe.bottom -
                    minVisibleHeight
            );

        return {
            left:
                Math.min(
                    Math.max(
                        safe.left,
                        Number(left) ||
                            safe.left
                    ),
                    maxLeft
                ),

            top:
                Math.min(
                    Math.max(
                        safe.top,
                        Number(top) ||
                            safe.top
                    ),
                    maxTop
                ),
        };
    }
    function panelPlacementFromRect(
        rect,
        preferredAnchor = ''
    ) {
        const viewport =
            panelViewportBounds();

        const leftGap =
            rect.left -
            viewport.left;

        const rightGap =
            viewport.right -
            rect.right;

        const anchor =
            preferredAnchor === 'left' ||
            preferredAnchor === 'right'
                ? preferredAnchor
                : (
                    rightGap <= leftGap
                        ? 'right'
                        : 'left'
                );

        const rawGap =
            anchor === 'right'
                ? rightGap
                : leftGap;

        return {
            layoutVersion:
                APP.UI_LAYOUT_VERSION,

            anchor,

            gapX:
                Math.max(
                    APP.PANEL_MARGIN_X,
                    Number(rawGap) || 0
                ),

            topOffset:
                Math.max(
                    APP.PANEL_MARGIN_Y,
                    Number(
                        rect.top -
                        viewport.top
                    ) || 0
                ),
        };
    }

    function panelPlacementFromSaved(
        box,
        saved
    ) {
        const current =
            saved &&
            typeof saved === 'object'
                ? saved
                : {};

        if (
            Number(
                current.layoutVersion
            ) ===
                APP.UI_LAYOUT_VERSION &&
            (
                current.anchor ===
                    'left' ||
                current.anchor ===
                    'right'
            ) &&
            Number.isFinite(
                Number(current.gapX)
            ) &&
            Number.isFinite(
                Number(
                    current.topOffset
                )
            )
        ) {
            return {
                layoutVersion:
                    APP.UI_LAYOUT_VERSION,

                anchor:
                    current.anchor,

                gapX:
                    Math.max(
                        APP.PANEL_MARGIN_X,
                        Number(
                            current.gapX
                        )
                    ),

                topOffset:
                    Math.max(
                        APP.PANEL_MARGIN_Y,
                        Number(
                            current.topOffset
                        )
                    ),
            };
        }

        const rect =
            box.getBoundingClientRect();

        if (
            Number.isFinite(
                Number(current.left)
            ) &&
            Number.isFinite(
                Number(current.top)
            )
        ) {
            const legacyRect = {
                left:
                    Number(
                        current.left
                    ),

                right:
                    Number(
                        current.left
                    ) +
                    rect.width,

                top:
                    Number(
                        current.top
                    ),

                bottom:
                    Number(
                        current.top
                    ) +
                    rect.height,

                width:
                    rect.width,

                height:
                    rect.height,
            };

            return panelPlacementFromRect(
                legacyRect
            );
        }

        return panelPlacementFromRect(
            rect,
            'right'
        );
    }

    function applyPanelPlacement(
        box,
        placement
    ) {
        fitPanelToViewport(
            box
        );

        const viewport =
            panelViewportBounds();

        const rect =
            box.getBoundingClientRect();

        const horizontal =
            panelHorizontalPosition(
                viewport,
                rect.width,
                placement?.anchor,
                placement?.gapX
            );

        const safe =
            panelSafeBounds(
                viewport
            );

        const headerHeight =
            Math.max(
                36,
                Number(
                    box.querySelector('header')
                        ?.getBoundingClientRect()
                        ?.height ||
                    0
                )
            );

        const minVisibleHeight =
            box.classList.contains('mini')
                ? Math.min(
                    44,
                    rect.height
                )
                : Math.min(
                    rect.height,
                    headerHeight + 120
                );

        const maxTop =
            Math.max(
                safe.top,
                safe.bottom -
                    minVisibleHeight
            );

        const preferredTop =
            viewport.top +
            Math.max(
                APP.PANEL_MARGIN_Y,
                Number(
                    placement?.topOffset
                ) ||
                APP.PANEL_MARGIN_Y
            );

        const top =
            Math.min(
                Math.max(
                    safe.top,
                    preferredTop
                ),
                maxTop
            );

        box.style.left =
            `${horizontal.left}px`;

        box.style.top =
            `${top}px`;

        box.style.right =
            'auto';

        fitPanelToViewport(
            box
        );

        return {
            layoutVersion:
                APP.UI_LAYOUT_VERSION,

            anchor:
                horizontal.anchor,

            gapX:
                Math.max(
                    APP.PANEL_MARGIN_X,
                    horizontal.gapX
                ),

            topOffset:
                Math.max(
                    APP.PANEL_MARGIN_Y,
                    top -
                    viewport.top
                ),
        };
    }

    function savePanelPlacement(
        placement,
        mini
    ) {
        saveUiState({
            layoutVersion:
                APP.UI_LAYOUT_VERSION,

            anchor:
                placement.anchor,

            gapX:
                placement.gapX,

            topOffset:
                placement.topOffset,

            mini:
                !!mini,

            /*
             * Explicitly retire the v1 absolute-pixel coordinates so future
             * restores cannot accidentally fall back to stale left/top data.
             */
            left: null,
            top: null,
        });
    }

    function updatePanelToggle(
        box
    ) {
        const toggle =
            box.querySelector(
                '#jkl-toggle'
            );

        if (!toggle) {
            return;
        }

        const mini =
            box.classList.contains(
                'mini'
            );

        toggle.textContent =
            mini
                ? '+'
                : '−';

        toggle.title =
            mini
                ? 'Restaurer la fenêtre'
                : 'Minimiser la fenêtre';
    }
    function installPanelController(
        box
    ) {
        const header =
            box.querySelector('header');

        const saved =
            loadUiState();

        box.classList.toggle(
            'mini',
            saved.mini === true
        );

        fitPanelToViewport(
            box
        );

        let placement =
            panelPlacementFromSaved(
                box,
                saved
            );

        placement =
            applyPanelPlacement(
                box,
                placement
            );

        savePanelPlacement(
            placement,
            box.classList.contains(
                'mini'
            )
        );

        updatePanelToggle(
            box
        );

        let drag = null;
        let refitFrame = 0;

        const refit =
            () => {
                refitFrame = 0;

                placement =
                    applyPanelPlacement(
                        box,
                        placement
                    );
            };

        const scheduleRefit =
            () => {
                if (refitFrame) {
                    return;
                }

                refitFrame =
                    requestAnimationFrame(
                        refit
                    );
            };

        const toggleMini =
            () => {
                /*
                 * Capture the current logical edge before width changes.
                 * The same edge gap is then restored with the new width.
                 */
                placement =
                    panelPlacementFromRect(
                        box.getBoundingClientRect(),
                        placement.anchor
                    );

                box.classList.toggle(
                    'mini'
                );

                placement =
                    applyPanelPlacement(
                        box,
                        placement
                    );

                savePanelPlacement(
                    placement,
                    box.classList.contains(
                        'mini'
                    )
                );

                updatePanelToggle(
                    box
                );
            };

        if (header) {
            const move =
                e => {
                    if (
                        !drag ||
                        e.pointerId !==
                            drag.pointerId
                    ) {
                        return;
                    }

                    const pos =
                        clampPanelPosition(
                            box,
                            drag.left +
                                (
                                    e.clientX -
                                    drag.x
                                ),
                            drag.top +
                                (
                                    e.clientY -
                                    drag.y
                                )
                        );

                    box.style.left =
                        `${pos.left}px`;

                    box.style.top =
                        `${pos.top}px`;

                    box.style.right =
                        'auto';

                    fitPanelToViewport(
                        box
                    );
                };

            const end =
                e => {
                    if (
                        !drag ||
                        e.pointerId !==
                            drag.pointerId
                    ) {
                        return;
                    }

                    placement =
                        panelPlacementFromRect(
                            box.getBoundingClientRect()
                        );

                    placement =
                        applyPanelPlacement(
                            box,
                            placement
                        );

                    savePanelPlacement(
                        placement,
                        box.classList.contains(
                            'mini'
                        )
                    );

                    try {
                        header.releasePointerCapture(
                            drag.pointerId
                        );
                    }
                    catch {}

                    drag = null;
                };

            header.addEventListener(
                'pointerdown',
                e => {
                    if (
                        e.button !== 0 ||
                        e.target.closest(
                            'button'
                        )
                    ) {
                        return;
                    }

                    const rect =
                        box.getBoundingClientRect();

                    drag = {
                        pointerId:
                            e.pointerId,

                        x:
                            e.clientX,

                        y:
                            e.clientY,

                        left:
                            rect.left,

                        top:
                            rect.top,
                    };

                    try {
                        header.setPointerCapture(
                            e.pointerId
                        );
                    }
                    catch {}

                    e.preventDefault();
                }
            );

            header.addEventListener(
                'pointermove',
                move
            );

            header.addEventListener(
                'pointerup',
                end
            );

            header.addEventListener(
                'pointercancel',
                end
            );
        }

        window.addEventListener(
            'resize',
            scheduleRefit,
            { passive: true }
        );

        window.visualViewport
            ?.addEventListener(
                'resize',
                scheduleRefit,
                { passive: true }
            );

        window.visualViewport
            ?.addEventListener(
                'scroll',
                scheduleRefit,
                { passive: true }
            );

        let lastPanelWidth =
            box.getBoundingClientRect()
                .width;

        const resizeObserver =
            typeof ResizeObserver ===
                'function'
                ? new ResizeObserver(
                    () => {
                        const width =
                            box
                                .getBoundingClientRect()
                                .width;

                        if (
                            Math.abs(
                                width -
                                lastPanelWidth
                            ) < 0.5
                        ) {
                            return;
                        }

                        lastPanelWidth =
                            width;

                        scheduleRefit();
                    }
                )
                : null;

        resizeObserver
            ?.observe(box);

        return {
            toggleMini,
            refit:
                scheduleRefit,
        };
    }

    function mediaRouteInfo(value) {
        return mediaPermalinkInfo(
            value
        );
    }

    function storyPermalinkInfo(value) {
        try {
            const u =
                new URL(
                    String(value || ''),
                    location.origin
                );
    
            const m =
                u.pathname.match(
                    /^\/stories\/([A-Za-z0-9._]+)\/(\d+)\/?/
                );
    
            if (!m) {
                return null;
            }
    
            const username =
                cleanUser(
                    m[1]
                );
    
            const mediaId =
                String(
                    m[2] || ''
                );
    
            if (
                !username ||
                username.toLowerCase() ===
                    'highlights' ||
                !/^\d+$/.test(mediaId)
            ) {
                return null;
            }
    
            const numericId =
                BigInt(mediaId);
    
            if (
                numericId <= 0n ||
                numericId >
                    ((1n << 64n) - 1n)
            ) {
                return null;
            }
    
            return {
                kind: 'story',
                route: 'story',
                username,
                mediaId,
                shortcode: '',
                key:
                    `story:${mediaId}`,
            };
        }
        catch {
            return null;
        }
    }


    // Instagram may show /stories/<username>/ without the item's ID.
    // This is only the VIEWER identity, NOT a verified media identity.
    function storyViewerRouteInfo(value) {
        try {
            const u=new URL(String(value||''),location.origin);
            const m=u.pathname.match(/^\/stories\/([A-Za-z0-9._]{1,30})\/?$/);
            if(!m) return null;
            const username=cleanUser(m[1]);
            if(!username || username.toLowerCase()==='highlights') return null;
            return {kind:'story-viewer',route:'story',username,
                mediaId:'',shortcode:'',key:'story-viewer:'+username.toLowerCase()};
        } catch {return null;}
    }

    function singleDownloadTargetFromUrl(value) {
        const media =
            mediaPermalinkInfo(
                value
            );
    
        if (media) {
            return {
                kind: 'media',
                route:
                    media.route,
                username: media.username || '',
                mediaId:
                    media.mediaId,
                shortcode:
                    media.shortcode,
                key:
                    `media:${media.mediaId}`,
            };
        }
    
        return storyPermalinkInfo(value) || storyViewerRouteInfo(value);
    }

    function singleDownloadTargetFromRoot(root) {
        if (!root) {
            return null;
        }
    
        const candidates =
            new Map();
    
        for (
            const anchor
            of root.querySelectorAll(
                'a[href*="/p/"],a[href*="/reel/"],a[href*="/reels/"],a[href*="/tv/"]'
            )
        ) {
            const target =
                singleDownloadTargetFromUrl(
                    anchor.href ||
                    anchor.getAttribute(
                        'href'
                    )
                );
    
            if (
                !target ||
                target.kind !== 'media'
            ) {
                continue;
            }
    
            const previous =
                candidates.get(
                    target.key
                );
    
            candidates.set(
                target.key,
                {
                    target,
                    count:
                        Number(
                            previous?.count ||
                            0
                        ) + 1,
                }
            );
        }
    
        return (
            [...candidates.values()]
                .sort(
                    (a, b) =>
                        b.count -
                        a.count
                )[0]
                ?.target ||
            null
        );
    }

    function currentSingleDownloadTarget() {
        const direct =
            singleDownloadTargetFromUrl(
                location.href
            );

        if (direct) {
            return direct;
        }

        // Profile-grid links are not an active media target.
        const root = currentMediaRoot();
        return root?.matches?.('div[role="dialog"]')
            ? singleDownloadTargetFromRoot(root)
            : null;
    }

    function applySingleDownloadTarget(
        button,
        target
    ) {
        if (
            !button ||
            !target
        ) {
            return;
        }
    
        delete button.dataset.shortcode;
        delete button.dataset.route;
        delete button.dataset.mediaId;
        delete button.dataset.targetKind;
        delete button.dataset.username;
    
        button.dataset.targetKind =
            target.kind;
    
        button.dataset.route =
            target.route ||
            '';
    
        button.dataset.mediaId =
            String(
                target.mediaId ||
                ''
            );
    
        if (target.shortcode) {
            button.dataset.shortcode =
                target.shortcode;
        }
    
        if (target.username) {
            button.dataset.username =
                target.username;
        }
    
        button.title =
            target.kind === 'story-viewer'
                ? 'Télécharger la story affichée uniquement'
                : target.kind === 'story'
                    ? 'Télécharger cette story uniquement'
                    : 'Télécharger cette publication uniquement';
    
        button.setAttribute(
            'aria-label',
            button.title
        );
    }

    function singleDownloadTargetFromButton(button) {
        if (!button) {
            return null;
        }
    
        const kind =
            String(
                button.dataset.targetKind ||
                ''
            );
    
        const mediaId =
            String(
                button.dataset.mediaId ||
                ''
            );
    
        const route =
            String(
                button.dataset.route ||
                ''
            );
    
        const shortcode =
            canonicalShortcode(
                button.dataset.shortcode ||
                ''
            );
    
        const username =
            cleanUser(
                button.dataset.username ||
                ''
            );
    
        if (
            (/^\d+$/.test(mediaId) &&
                (kind === 'story' || kind === 'media')) ||
            (kind === 'story-viewer' && !mediaId && username &&
                storyViewerRouteInfo(location.href)?.username.toLowerCase() ===
                    username.toLowerCase())
        ) {
            return {
                kind,
                route:
                    route ||
                    (
                        kind === 'story' || kind === 'story-viewer'
                            ? 'story'
                            : 'p'
                    ),
                mediaId,
                shortcode,
                username,
                key:
                    kind === 'story-viewer'
                        ? 'story-viewer:' + username.toLowerCase()
                        : `${kind}:${mediaId}`,
            };
        }
    
        // Never substitute a different Story after a stale viewer click.
        if (kind === 'story-viewer') return null;
        return currentSingleDownloadTarget();
    }

    function standaloneFilename(
        username,
        type,
        timestamp,
        id,
        ext
    ) {
        return (
            `${sanitize(username || 'instagram')} - ` +
            `${type} - ` +
            `${datePart(timestamp)} - ` +
            `${sanitize(id)}.${ext}`
        );
    }

    function standaloneUnits(
        raw,
        forcedType = '',
        expectedRootId = ''
    ) {
        const root =
            raw?.media &&
            typeof raw.media === 'object'
                ? raw.media
                : raw;

        if (!root || typeof root !== 'object') {
            throw new Error('SINGLE: missing authenticated media root');
        }

        const rootId = normalizePk(root);
        if (!/^\d+$/.test(rootId) ||
            (expectedRootId && rootId !== String(expectedRootId))) {
            throw new Error(
                'SINGLE: Instagram media-info root identity does not match the requested media'
            );
        }

        const type =
            rootKind(
                root,
                forcedType
            );

        const username =
            cleanUser(
                root?.user?.username ||
                root?.owner?.username ||
                currentProfile() ||
                state.username ||
                'instagram'
            ) ||
            'instagram';

        const children =
            Array.isArray(root.carousel_media) &&
            root.carousel_media.length
                ? root.carousel_media
                : (
                    root
                        ?.edge_sidecar_to_children
                        ?.edges ||
                    []
                )
                    .map(e => e?.node)
                    .filter(Boolean);

        // A single-download must be all-or-nothing for the
        // chosen root. Do not silently save only the first available
        // children of an incomplete carousel.
        const product = String(
            root.product_type || root.media_product_type || ''
        ).toLowerCase();
        const carousel = Number(root.media_type) === 8 ||
            root.__typename === 'GraphSidecar' ||
            product === 'carousel_container' ||
            product === 'carousel' ||
            children.length > 1;
        const countRaw = root.carousel_media_count;
        const claimed = countRaw == null || countRaw === ''
            ? 0 : Number(countRaw);
        if ((countRaw != null && countRaw !== '' &&
            (!Number.isSafeInteger(claimed) || claimed < 0)) ||
            root?.edge_sidecar_to_children?.page_info?.has_next_page === true ||
            (carousel && children.length < 2) ||
            (claimed > 0 && claimed > (children.length || 1))) {
            throw new Error(
                'SINGLE: carousel structure is incomplete; refusing a partial download'
            );
        }

        const units = children.length ? children : [root];
        const out = [];
        const seen = new Set();

        for (const child of units) {
            const id = normalizePk(child);
            if (!/^\d+$/.test(id) || seen.has(id)) {
                throw new Error(
                    'SINGLE: missing or duplicated carousel media identity'
                );
            }
            seen.add(id);

            const video = isVideo(child);
            const url = video ? bestVideo(child) : bestImage(child);
            if (!url) {
                throw new Error(
                    'SINGLE: media URL unavailable; refusing incomplete batch'
                );
            }

            const timestamp =
                Number(
                    child?.taken_at ||
                    child?.taken_at_timestamp ||
                    root?.taken_at ||
                    root?.taken_at_timestamp ||
                    0
                );

            const ext =
                video
                    ? 'mp4'
                    : 'jpg';

            out.push({
                id: String(id),
                type,
                timestamp,
                ext,
                url,
                username,
                filename:
                    standaloneFilename(
                        username,
                        type,
                        timestamp,
                        id,
                        ext
                    ),
            });
        }

        return out;
    }


    async function fetchStandaloneMediaInfo(
        rootId,
        label = 'SINGLE media'
    ) {
        if (state.feedbackRequired) {
            throw feedbackCircuitBreak(
                `${label}: Instagram returned feedback_required in this page session.`
            );
        }

        if (state.rateLimited) {
            throw rateLimitCircuitBreak(
                `${label}: Instagram returned HTTP 429 in this page session.`
            );
        }

        if (state.apiUnhealthy) {
            throw apiUnhealthyError(
                `${label}: Instagram API session is unhealthy in this page session.`
            );
        }

        /* No scan/download is running here; clear only a stale manual-cancel flag. */
        state.cancelled = false;

        return fetchOwnedMediaInfo(
            rootId,
            label
        );
    }


    function downloadStandaloneAttempt(file) {
        return new Promise(
            (resolve, reject) => {
                try {
                    GM_download({
                        url: file.url,

                        name:
                            archiveDownloadPath(
                                file,
                                file.username
                            ),

                        saveAs:
                            false,

                        conflictAction:
                            'overwrite',

                        headers: {
                            Referer:
                                'https://www.instagram.com/',
                        },

                        onload:
                            () => resolve(),

                        onerror:
                            e => reject(
                                new Error(
                                    e?.error ||
                                    e?.details ||
                                    'download failed'
                                )
                            ),

                        ontimeout:
                            () => reject(
                                new Error(
                                    'download timeout'
                                )
                            ),
                    });
                }
                catch (e) {
                    reject(e);
                }
            }
        );
    }

    async function downloadStandaloneFile(file) {
        let last = null;

        for (
            let attempt = 1;
            attempt <= APP.DOWNLOAD_RETRIES;
            attempt++
        ) {
            try {
                await downloadStandaloneAttempt(file);
                return true;
            }
            catch (e) {
                last = e;

                if (
                    attempt <
                    APP.DOWNLOAD_RETRIES
                ) {
                    const wait =
                        700 * attempt +
                        rand(150, 650);

                    log(
                        `↻ SINGLE ${file.filename} — retry ` +
                        `${attempt + 1}/${APP.DOWNLOAD_RETRIES} ` +
                        `after ${e.message}`,
                        'warn'
                    );

                    await sleep(wait);
                }
            }
        }

        throw (
            last ||
            new Error(
                'download failed after retries'
            )
        );
    }

    // Identity check for the visible Story occurs only on an explicit click.
    // Never infer a media ID from /stories/<username>/ itself.
    function storyAssetKey(value) {
        try {
            const u=new URL(String(value||''));
            if(u.protocol!=='https:' ||
                !/(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i.test(u.hostname))
                return '';
            return u.pathname;
        } catch { return ''; }
    }

    function storyVisibleAssetKey() {
        const vw=Number(window.innerWidth||0),vh=Number(window.innerHeight||0);
        return [...document.querySelectorAll('video,img')]
            .filter(el=>{
                if(el.closest?.('#jkl-igb,[aria-hidden="true"]')) return false;
                const r=el.getBoundingClientRect?.();
                return r && r.width>=140 && r.height>=180 &&
                    r.right>0 && r.bottom>0 && r.left<vw && r.top<vh &&
                    Math.abs((r.left+r.right)/2-vw/2)<=vw*.38;
            })
            .map(el=>{
                const r=el.getBoundingClientRect();
                return {el,score:Math.max(0,Math.min(vw,r.right)-Math.max(0,r.left))*
                    Math.max(0,Math.min(vh,r.bottom)-Math.max(0,r.top))*
                    (el.tagName?.toLowerCase()==='video'?1.15:1)};
            })
            .sort((a,b)=>b.score-a.score)
            .map(x=>storyAssetKey(x.el.currentSrc||x.el.src||
                x.el.getAttribute?.('src')||''))
            .find(Boolean) || '';
    }

    function storyItemAssetKeys(item) {
        const variants=[
            item?.video_url,item?.display_url,item?.display_uri,item?.thumbnail_src,
            ...(item?.video_versions||[]).map(x=>x?.url),
            ...(item?.image_versions2?.candidates||[]).map(x=>x?.url),
            ...(item?.display_resources||[]).map(x=>x?.src),
            bestVideo(item),bestImage(item),
        ];
        return new Set(variants.map(storyAssetKey).filter(Boolean));
    }

    async function resolveStoryViewerItem(target) {
        const before=storyViewerRouteInfo(location.href);
        if(!before || target?.kind!=='story-viewer' ||
            before.username.toLowerCase()!==String(target.username||'').toLowerCase())
            throw new Error('SINGLE STORY: le lecteur ne correspond plus au compte demandé.');

        const visibleBefore=storyVisibleAssetKey();
        const username=before.username;
        let userId=String(state.username.toLowerCase()===username.toLowerCase()
            ? state.userId||'' : '');
        if(!/^\d+$/.test(userId)) {
            // Only one verified profile HTML request, on deliberate click.
            const profile=await fetchProfilePageMetadata(username);
            userId=String(profile?.pk||profile?.id||'').split('_')[0];
            if(!/^\d+$/.test(userId))
                throw new Error('SINGLE STORY: ID du compte non confirmé.');
        }
        const reels=await fetchWebStoryReel(userId,false,'SINGLE STORY viewer');
        const reel=reels.find(x=>hiId(x?.id)===userId);
        if(!reel || !Array.isArray(reel.items) || reel.items.length===0)
            throw new Error('SINGLE STORY: aucune Story authentifiée pour ce compte.');

        const items=reel.items.filter(x=>/^\d+$/.test(normalizePk(x)));
        if(items.length!==reel.items.length)
            throw new Error('SINGLE STORY: identité média absente dans la réponse.');
        let selected;
        if(items.length===1) {
            selected=items[0];
        } else {
            const matches=visibleBefore
                ? items.filter(x=>storyItemAssetKeys(x).has(visibleBefore))
                : [];
            if(matches.length!==1)
                throw new Error('SINGLE STORY: plusieurs Stories, le média affiché est ambigu. Aucun téléchargement.');
            selected=matches[0];
        }

        const after=storyViewerRouteInfo(location.href);
        if(!after || after.username.toLowerCase()!==username.toLowerCase() ||
            (items.length>1 && storyVisibleAssetKey()!==visibleBefore))
            throw new Error('SINGLE STORY: le lecteur a changé pendant la vérification.');

        const id=normalizePk(selected);
        log('SINGLE STORY viewer verified: account='+username+
            ', items='+items.length+', id='+id+'.');
        // Keep full media-info, filenames and all-or-nothing downloader.
        const item=await fetchStandaloneMediaInfo(id,'SINGLE STORY '+id);
        const finalRoute=storyViewerRouteInfo(location.href);
        if(!finalRoute || finalRoute.username.toLowerCase()!==username.toLowerCase() ||
            (items.length>1 && storyVisibleAssetKey()!==visibleBefore))
            throw new Error('SINGLE STORY: le lecteur a changé avant le téléchargement.');
        return item;
    }

    async function downloadSingleTarget(
        target,
        button = null
    ) {
        const resolved =
            target &&
            typeof target === 'object'
                ? target
                : null;
    
        const id =
            String(
                resolved?.mediaId ||
                ''
            );
    
        const key =
            String(
                resolved?.key ||
                (
                    resolved?.kind &&
                    id
                        ? `${resolved.kind}:${id}`
                        : ''
                )
            );
    
        if (
            !resolved ||
            (!/^\d+$/.test(id) && resolved.kind!=='story-viewer') ||
            !key ||
            singleDownloadState.busy.has(
                key
            )
        ) {
            return;
        }
    
        if (
            state.running ||
            state.downloading
        ) {
            status(
                'Téléchargement unitaire indisponible pendant un SCAN/DOWNLOAD.',
                'warn'
            );
    
            return;
        }
    
        if (
            state.feedbackRequired ||
            state.rateLimited ||
            state.apiUnhealthy
        ) {
            const stopReason =
                state.feedbackRequired
                    ? 'feedback_required'
                    : state.rateLimited
                        ? 'HTTP 429'
                        : 'une réponse API invalide';
    
            status(
                `Téléchargement unitaire bloqué après ${stopReason} dans cette session.`,
                'warn'
            );
    
            return;
        }
    
        const label =
            resolved.kind==='story-viewer'
                ? 'story affichée @'+resolved.username
                : resolved.kind==='story'
                    ? `story ${id}`
                    : (resolved.shortcode || id);
    
        log(
            `Single download requested: kind=${resolved.kind}, route=${resolved.route || '-'}, ` +
            `shortcode=${resolved.shortcode || '-'}, id=${id}.`
        );
    
        singleDownloadState.busy.add(
            key
        );
        // Use the common scan/download mutex; never overlap single
        // actions with a bulk scan or another single-media transfer.
        state.downloading = true;
    
        const oldHtml =
            button?.innerHTML ||
            '';
    
        if (button) {
            button.disabled = true;
            button.classList.add(
                'busy'
            );
            button.textContent = '…';
        }
    
        try {
            status(
                `Téléchargement de ${label}…`
            );
    
            const item =
                resolved.kind==='story-viewer'
                    ? await resolveStoryViewerItem(resolved)
                    : await fetchStandaloneMediaInfo(
                        id,
                        `SINGLE ${String(resolved.kind || 'media').toUpperCase()} ${label}`
                    );
            const actualId=resolved.kind==='story-viewer'
                ? normalizePk(item) : id;

            const forcedType =
                (resolved.kind === 'story' || resolved.kind === 'story-viewer')
                    ? 'STORY'
                    : resolved.route === 'reel'
                        ? 'REEL'
                        : '';
    
            const files =
                standaloneUnits(
                    item,
                    forcedType,
                    actualId
                );
    
            if (!files.length) {
                throw new Error(
                    'aucun fichier téléchargeable'
                );
            }
    
            for (
                let i = 0;
                i < files.length;
                i++
            ) {
                await downloadStandaloneFile(
                    files[i]
                );
    
                if (
                    i + 1 <
                    files.length
                ) {
                    await sleep(
                        APP.DOWNLOAD_DELAY
                    );
                }
            }
    
            log(
                `Single download: ${label} → ${files.length} file(s).`
            );
    
            status(
                `${label}: ${files.length} fichier(s) téléchargé(s).`,
                'ok'
            );
    
            if (button) {
                button.classList.remove(
                    'busy'
                );
                button.classList.add(
                    'ok'
                );
                button.textContent = '✓';
    
                setTimeout(
                    () => {
                        if (
                            button.isConnected
                        ) {
                            button.classList.remove(
                                'ok'
                            );
                            button.innerHTML =
                                oldHtml;
                            button.disabled =
                                false;
                        }
                    },
                    1600
                );
            }
        }
        catch (e) {
            log(
                `Single download failed ${label}: ${e.message}`,
                'error'
            );
    
            status(
                `${label}: ${e.message}`,
                'error'
            );
    
            if (button) {
                button.classList.remove(
                    'busy'
                );
                button.classList.add(
                    'error'
                );
                button.textContent = '!';
    
                setTimeout(
                    () => {
                        if (
                            button.isConnected
                        ) {
                            button.classList.remove(
                                'error'
                            );
                            button.innerHTML =
                                oldHtml;
                            button.disabled =
                                false;
                        }
                    },
                    2200
                );
            }
        }
        finally {
            singleDownloadState.busy.delete(
                key
            );
            state.downloading = false;
    
            if (
                button &&
                button.isConnected &&
                !button.classList.contains(
                    'ok'
                ) &&
                !button.classList.contains(
                    'error'
                )
            ) {
                button.disabled = false;
                button.classList.remove(
                    'busy'
                );
                button.innerHTML =
                    oldHtml;
            }
        }
    }

    function singleDownloadButtonFromEvent(event) {
        return (
            event?.target?.closest?.(
                '.jkl-single-download, #jkl-current-download'
            ) ||
            null
        );
    }

    function handleSingleDownloadPress(event) {
        const button =
            singleDownloadButtonFromEvent(
                event
            );
    
        if (!button) {
            return;
        }
    
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

    function handleSingleDownloadClick(event) {
        const button =
            singleDownloadButtonFromEvent(
                event
            );
    
        if (!button) {
            return;
        }
    
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    
        const target =
            singleDownloadTargetFromButton(
                button
            );
    
        if (!target) {
            log(
                'Single download click ignored: current media target could not be resolved.',
                'error'
            );
    
            status(
                'Téléchargement unitaire: média introuvable.',
                'error'
            );
    
            return;
        }
    
        void downloadSingleTarget(
            target,
            button
        );
    }
    function installSingleDownloadEvents() {
        if (
            singleDownloadState.eventsInstalled
        ) {
            return;
        }
    
        singleDownloadState.eventsInstalled =
            true;
    
        for (
            const eventName
            of [
                'pointerdown',
                'mousedown',
                'touchstart',
            ]
        ) {
            window.addEventListener(
                eventName,
                handleSingleDownloadPress,
                true
            );
        }
    
        window.addEventListener(
            'click',
            handleSingleDownloadClick,
            true
        );
    }
    function singleDownloadIconHtml() {
        return `
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    d="M12 3v11m0 0 4-4m-4 4-4-4M5 18v2h14v-2"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        `;
    }
    function addSingleDownloadButtonToAnchor(anchor) {
        if (!anchor?.isConnected) return;
        const target=singleDownloadTargetFromUrl(
            anchor.href || anchor.getAttribute('href')
        );
        if(!target || target.kind!=='media') return;

        // Opened-media view has a separate body-level fixed button.
        // Don't duplicate controls inside its modal.
        if(anchor.closest?.('div[role="dialog"]') &&
            singleDownloadTargetFromUrl(location.href)?.kind==='media') return;

        const rect=anchor.getBoundingClientRect();
        // Instagram tiles can use CSS art rather than nested IMG/VIDEO.
        // Require a real in-viewport tile so profile links are ignored.
        if(rect.width<96 || rect.height<96 ||
            rect.right<=0 || rect.bottom<=0 ||
            rect.left>=window.innerWidth || rect.top>=window.innerHeight) return;
        const host=anchor.parentElement;
        if(!host || host===document.body) return;
        const existing=[...host.children].find(el=>
            el.classList?.contains('jkl-single-download'));
        if(existing){
            // Do not trust an old data-attribute after React removed the
            // button; only a currently connected, matching button counts.
            if(existing.isConnected &&
                existing.dataset.jklAnchorId===target.mediaId) return;
            if(existing.isConnected) return; // ambiguous shared host
            existing.remove();
        }
        if(getComputedStyle(host).position==='static') {
            host.style.position='relative';
        }
        host.dataset.jklSingleHost='1';
        const button=document.createElement('button');
        button.type='button';
        button.className='jkl-single-download';
        button.dataset.jklAnchorId=target.mediaId;
        button.innerHTML=singleDownloadIconHtml();
        applySingleDownloadTarget(button,target);
        host.appendChild(button);
        anchor.dataset.jklSingleDownload='1';
    }
    function currentMediaRoot() {
        const viewportW=window.innerWidth || 1;
        const viewportH=window.innerHeight || 1;
        const visible=el=>{
            const r=el?.getBoundingClientRect?.();
            return r && r.width>=180 && r.height>=140 &&
                r.right>0 && r.bottom>0 &&
                r.left<viewportW && r.top<viewportH;
        };

        // A content warning can replace the IMG/VIDEO entirely. The dialog
        // still identifies the actively opened post or Reel by its URL.
        const dialogs=[...document.querySelectorAll('div[role="dialog"]')]
            .filter(visible);
        if(dialogs.length) return dialogs[dialogs.length-1];

        if(storyPermalinkInfo(location.href) || storyViewerRouteInfo(location.href)) {
            const sections=[...document.querySelectorAll('section')]
                .filter(visible);
            return sections.reverse().find(el=>el.querySelector('img,video')) ||
                document.querySelector('main') || sections[0] || null;
        }

        const articles=[...document.querySelectorAll('article')]
            .filter(visible);
        if(articles.length){
            const candidates=articles.filter(el=>el.querySelector('img,video'));
            return (candidates.length ? candidates : articles)
                .sort((a,b)=>{
                    const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
                    return Math.abs(ra.left+ra.width/2-viewportW/2)-
                        Math.abs(rb.left+rb.width/2-viewportW/2);
                })[0];
        }

        const main=document.querySelector('main[role="main"]') ||
            document.querySelector('main');
        return visible(main) ? main : null;
    }

    function largestCurrentMedia(root) {
        if (!root) return null;

        const width = Math.max(
            1, window.innerWidth ||
                document.documentElement.clientWidth
        );
        const height = Math.max(
            1, window.innerHeight ||
                document.documentElement.clientHeight
        );

        return [...root.querySelectorAll('video,img')]
            .map(media => {
                const rect = media.getBoundingClientRect();
                const style = getComputedStyle(media);

                if (
                    !media.getClientRects().length ||
                    media.closest?.(
                        '#jkl-igb,[aria-hidden="true"]'
                    ) ||
                    style.display === 'none' ||
                    style.visibility === 'hidden' ||
                    rect.width < 180 ||
                    rect.height < 180
                ) return null;

                const visibleW = Math.max(
                    0, Math.min(width,rect.right) -
                        Math.max(0,rect.left)
                );
                const visibleH = Math.max(
                    0, Math.min(height,rect.bottom) -
                        Math.max(0,rect.top)
                );
                if (
                    visibleW < 140 ||
                    visibleH < 140
                ) return null;

                const dx = (
                    rect.left + rect.width / 2 -
                    width / 2
                ) / (width / 2);
                const dy = (
                    rect.top + rect.height / 2 -
                    height / 2
                ) / (height / 2);
                const offCenter = Math.min(
                    1, Math.hypot(dx,dy) / Math.SQRT2
                );
                const videoBonus =
                    /\/reel\/|\/stories\//.test(
                        location.pathname
                    ) &&
                    media.tagName?.toLowerCase() ===
                        'video' ? 1.1 : 1;

                return {
                    media,
                    score:visibleW * visibleH *
                        (1 - offCenter * 0.35) *
                        videoBonus,
                };
            })
            .filter(Boolean)
            .sort((a,b)=>b.score-a.score)
            [0]?.media || null;
    }

    function currentMediaOverlayHost(media,root) {
        // Viewport-based anchor: never depend on React's exact media
        // ancestor dimensions or inject our button inside its DOM.
        const vw=window.innerWidth || 0,vh=window.innerHeight || 0;
        if(!root || !vw || !vh) return null;
        const visible=el=>{
            const r=el?.getBoundingClientRect?.();
            return r && r.width>=160 && r.height>=140 &&
                r.right>0 && r.bottom>0 && r.left<vw && r.top<vh
                ? r : null;
        };
        const rect=visible(media) ||
            visible(root.querySelector?.('article')) ||
            visible(root);
        if(!rect) return null;

        // A main/dialog may fill the viewport while the actual Reel is
        // centered in a narrower column. Keep the button beside that
        // column, not at the extreme right of the browser.
        const wide=rect.width>vw*.82;
        const width=wide
            ? Math.min(rect.width,Math.max(280,Math.min(640,vw*.62)))
            : rect.width;
        const leftEdge=wide ? rect.left+(rect.width-width)/2 : rect.left;
        const top=Math.max(8,Math.min(vh-48,rect.top+12));
        let left=Math.max(8,Math.min(vw-48,leftEdge+width-48));

        // Avoid covering the button with our own high-z-index panel.
        const panel=ui.box?.getBoundingClientRect?.();
        if(panel && left+38>panel.left && left<panel.right &&
            top+38>panel.top && top<panel.bottom) {
            left=Math.max(8,Math.min(vw-48,leftEdge+12));
        }
        return {left:Math.round(left),top:Math.round(top)};
    }

    // The viewer may use /stories/<username>/ with NO numeric media ID.
    // Its floating control is only an affordance: identify the exact
    // currently playing media at click time, never from the viewer URL
    // alone. Do not request media-info or download before explicit click.
    function storyFloatingAnchor(target) {
        const route=target?.kind==='story-viewer'
            ? storyViewerRouteInfo(location.href) : storyPermalinkInfo(location.href);
        if (!target || !route || target.kind!==route.kind ||
            (target.kind==='story' && route.mediaId!==String(target.mediaId)) ||
            route.username.toLowerCase()!==String(target.username||'').toLowerCase())
            return null;

        const vw = Number(window.innerWidth || 0);
        const vh = Number(window.innerHeight || 0);
        if (vw < 180 || vh < 180) return null;

        // Prefer the actual visible central story image/video; do not
        // mistake a small avatar, an invisible preload or our own panel
        // for the playing story.
        const visible = [...document.querySelectorAll('video,img')]
            .filter(el => {
                if (el.closest?.('#jkl-igb,[aria-hidden="true"]')) return false;
                const r = el.getBoundingClientRect?.();
                if (!r || r.width < 140 || r.height < 180 ||
                    r.right <= 0 || r.bottom <= 0 ||
                    r.left >= vw || r.top >= vh) return false;
                const center = (r.left + r.right) / 2;
                return Math.abs(center - vw / 2) <= vw * .38;
            })
            .map(el => {
                const r = el.getBoundingClientRect();
                const width = Math.max(0,Math.min(vw,r.right) - Math.max(0,r.left));
                const height = Math.max(0,Math.min(vh,r.bottom) - Math.max(0,r.top));
                return {r,score:width*height*
                    (el.tagName?.toLowerCase() === 'video' ? 1.15 : 1)};
            })
            .sort((a,b) => b.score - a.score)[0]?.r || null;

        // Instagram may mount the Story shell before its IMG/VIDEO.
        // The Story VIEWER identity is verified from the URL. Placement
        // does not prove which individual media is playing.
        const viewerWidth = Math.min(480,vw*.72);
        const rightEdge = visible
            ? Math.min(vw - 8,visible.right)
            : (vw + viewerWidth) / 2;
        const topEdge = visible
            ? visible.top
            : Math.max(0,vh*.04);
        let left = Math.max(8,Math.min(vw-48,rightEdge-48));
        const top = Math.max(48,Math.min(vh-48,topEdge+56));

        const panel = ui.box?.getBoundingClientRect?.();
        if (panel && left+38>panel.left && left<panel.right &&
            top+38>panel.top && top<panel.bottom) {
            const leftEdge = visible
                ? visible.left
                : (vw-viewerWidth)/2;
            left = Math.max(8,Math.min(vw-48,leftEdge+12));
        }
        return {left:Math.round(left),top:Math.round(top)};
    }

    function ensureCurrentDownloadButton() {
        let button =
            document.getElementById(
                'jkl-current-download'
            );

        if (button) {
            return button;
        }

        button =
            document.createElement(
                'button'
            );

        button.id =
            'jkl-current-download';

        button.type =
            'button';

        button.title =
            'Télécharger cette publication uniquement';

        button.setAttribute(
            'aria-label',
            button.title
        );

        button.innerHTML =
            singleDownloadIconHtml();

        return button;
    }

    function placeCurrentDownloadButton(button,root,anchorOverride=null) {
        const anchor=anchorOverride ||
            currentMediaOverlayHost(largestCurrentMedia(root),root);
        if(!anchor){
            button.remove();
            return 'unavailable';
        }
        // Body-level fixed positioning bypasses Instagram's clipping and
        // stacking contexts, but remains visually glued to the media.
        button.classList.add('jkl-media-download-overlay');
        if(button.parentElement!==document.body) document.body.appendChild(button);
        const left=anchor.left+'px',top=anchor.top+'px';
        if(button.style.left!==left) button.style.left=left;
        if(button.style.top!==top) button.style.top=top;
        return 'viewport-pinned-media';
    }

    function updateSingleDownloadPanel() {
        // The persistent panel action never depends on Instagram's current
        // image/video DOM. Age/sensitive-content interstitials may hide
        // those elements while the permalink still identifies the media.
        if (!ui.singleCurrent) return;
        const target = currentSingleDownloadTarget();
        const disabled = !target || state.running || state.downloading ||
            state.feedbackRequired || state.rateLimited || state.apiUnhealthy;
        if (ui.singleCurrent.disabled !== disabled) {
            ui.singleCurrent.disabled = disabled;
        }
        const label = !target
            ? 'Ouvre un POST, un REEL ou une STORY'
            : (state.running || state.downloading)
                ? 'Opération en cours — téléchargement unitaire indisponible'
                : (state.feedbackRequired || state.rateLimited ||
                    state.apiUnhealthy)
                    ? 'Session Instagram bloquée — téléchargement indisponible'
                    : 'Média ciblé : ' +
                        (target.username ? '@' + target.username + ' · ' : '') +
                        (target.route || target.kind).toUpperCase() +
                        ' · ' + (target.shortcode || target.mediaId || 'identification au clic');
        if (ui.singleTarget && ui.singleTarget.textContent !== label) {
            ui.singleTarget.textContent = label;
        }
        // No automatic media-info calls: only an explicit button click
        // can start a single-media transfer.
    }

    function handlePanelSingleDownload() {
        const target = currentSingleDownloadTarget();
        if (!target) {
            log('Single download panel: no opened-media permalink or unambiguous dialog target.', 'warn');
            status('Ouvre un média individuel avant le téléchargement solo.', 'warn');
            return;
        }
        log(
            'Single download panel click: kind=' + target.kind +
            ', route=' + (target.route || '-') +
            ', shortcode=' + (target.shortcode || '-') +
            ', id=' + target.mediaId + '.'
        );
        void downloadSingleTarget(target, ui.singleCurrent);
    }

    function refreshCurrentDownloadButton() {
        const target=currentSingleDownloadTarget();
        const existing=document.getElementById('jkl-current-download');
        if(!target){
            existing?.remove();
            singleDownloadState.lastOverlayDiagnostic='';
            return;
        }
        const root=currentMediaRoot();
        const media=largestCurrentMedia(root);
        const isStory=target.kind==='story' || target.kind==='story-viewer';
        const anchor=isStory
            ? storyFloatingAnchor(target)
            : currentMediaOverlayHost(media,root);
        if(!anchor){
            existing?.remove();
            const diagnostic=target.key+':no_safe_media_region';
            if(singleDownloadState.lastOverlayDiagnostic!==diagnostic){
                singleDownloadState.lastOverlayDiagnostic=diagnostic;
                log('Single media floating button unavailable: no safe '+
                    'visible region for '+target.key+'.','warn');
            }
            return;
        }
        singleDownloadState.lastOverlayDiagnostic='';
        const button=ensureCurrentDownloadButton();
        applySingleDownloadTarget(button,target);
        button.dataset.placement=isStory
            ? (placeCurrentDownloadButton(button,root,anchor), 'viewport-pinned-story')
            : placeCurrentDownloadButton(button,root,anchor);
        button.disabled=state.running || state.downloading ||
            state.feedbackRequired || state.rateLimited || state.apiUnhealthy;
    }

    function refreshSingleDownloadUi() {
        for (
            const anchor
            of document.querySelectorAll(
                'a[href*="/p/"],a[href*="/reel/"],a[href*="/reels/"],a[href*="/tv/"]'
            )
        ) {
            addSingleDownloadButtonToAnchor(
                anchor
            );
        }

        refreshCurrentDownloadButton();
        updateSingleDownloadPanel();
    }

    function scheduleSingleDownloadUi() {
        clearTimeout(
            singleDownloadState.timer
        );

        singleDownloadState.timer =
            setTimeout(
                refreshSingleDownloadUi,
                250
            );
    }

    function installSingleDownloadUi() {
        if (
            singleDownloadState.observer
        ) {
            return;
        }

        installSingleDownloadEvents();
        refreshSingleDownloadUi();

        singleDownloadState.observer =
            new MutationObserver(
                scheduleSingleDownloadUi
            );

        singleDownloadState.observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true,
            }
        );

        window.addEventListener(
            'popstate',
            scheduleSingleDownloadUi
        );
        window.addEventListener(
            'hashchange',
            scheduleSingleDownloadUi
        );
        window.addEventListener(
            'scroll',
            scheduleSingleDownloadUi,
            {capture:true,passive:true}
        );
        window.addEventListener(
            'resize',
            scheduleSingleDownloadUi,
            {passive:true}
        );
        // Instagram uses pushState for in-app navigation, which does not
        // dispatch popstate. Recheck only the URL once a second; never
        // poll media-info or create Instagram network traffic.
        singleDownloadState.lastLocation = location.href;
        singleDownloadState.locationTimer = setInterval(() => {
            if (location.href !== singleDownloadState.lastLocation) {
                singleDownloadState.lastLocation = location.href;
                scheduleSingleDownloadUi();
            }
        },1000);
    }

    function createUi() {
        GM_addStyle(`
            #jkl-igb {
                position:fixed;
                z-index:2147483646;
                right:${APP.PANEL_MARGIN_X}px;
                top:76px;
                box-sizing:border-box;
                width:420px;
                min-width:0;
                max-width:calc(
                    100vw -
                    ${APP.PANEL_MARGIN_X * 2}px
                );
                background:#111;
                color:#f5f5f5;
                border:1px solid #3a3a3a;
                border-radius:12px;
                box-shadow:0 8px 30px rgba(0,0,0,.45);
                font:12px/1.35 Arial,sans-serif;
                display:flex;
                flex-direction:column;
                max-height:calc(
                    100vh -
                    ${APP.PANEL_MARGIN_Y * 2}px
                );
                max-height:calc(
                    100dvh -
                    ${APP.PANEL_MARGIN_Y * 2}px
                );
                overflow:hidden;
                contain:layout paint inline-size;
            }

            #jkl-igb * {
                box-sizing:border-box;
            }

            /*
             * UI width invariant:
             * dynamic content must never participate in the panel's intrinsic
             * inline-size. This applies to filenames, paths, logs, status text,
             * diagnostics and any future dynamic strings.
             */
            #jkl-igb .body,
            #jkl-igb .body *,
            #jkl-igb header,
            #jkl-igb header * {
                min-inline-size:0;
            }

            #jkl-igb .body {
                inline-size:100%;
                max-inline-size:100%;
                contain:inline-size;
            }

            #jkl-igb .body > *,
            #jkl-igb header > *,
            #jkl-igb .progress-head > *,
            #jkl-igb .jkl-card-head > *,
            #jkl-igb .diag-row > * {
                min-width:0;
                max-width:100%;
            }

            #jkl-igb .status,
            #jkl-igb .diag-row b,
            #jkl-igb .jkl-card-line,
            #jkl-igb .log {
                overflow-wrap:anywhere;
                word-break:break-word;
            }

            #jkl-igb header {
                display:flex;
                justify-content:space-between;
                align-items:center;
                padding:10px 12px;
                background:#1b1b1b;
                border-bottom:1px solid #333;
                cursor:move;
                user-select:none;
                touch-action:none;
            }

            #jkl-igb header button {
                background:none;
                color:#aaa;
                border:0;
                cursor:pointer;
                font-size:16px;
            }

            #jkl-igb .body {
                min-height:0;
                padding:10px;
                overflow-x:hidden;
                overflow-y:auto;
                overscroll-behavior:contain;
                scrollbar-gutter:stable;
            }

            #jkl-igb .body::-webkit-scrollbar {
                width:9px;
            }

            #jkl-igb .body::-webkit-scrollbar-thumb {
                border:2px solid #111;
                border-radius:999px;
                background:#4a4a4a;
            }

            #jkl-igb .body::-webkit-scrollbar-track {
                background:#161616;
            }

            #jkl-igb input[type=text] {
                width:100%;
                background:#202020;
                color:#fff;
                border:1px solid #444;
                border-radius:8px;
                padding:7px 9px;
            }

            #jkl-igb .checks {
                display:grid;
                grid-template-columns:repeat(
                    3,
                    minmax(0,1fr)
                );
                gap:5px;
                margin:8px 0;
            }

            #jkl-igb label {
                display:flex;
                gap:4px;
                align-items:center;
                white-space:nowrap;
            }

            #jkl-igb .checks label {
                justify-content:flex-start;
                padding:5px 7px;
                border:1px solid #303030;
                border-radius:7px;
                background:#171717;
                color:#bdbdbd;
                font-size:10px;
            }

            #jkl-igb .buttons {
                display:grid;
                grid-template-columns:repeat(
                    2,
                    minmax(0,1fr)
                );
                gap:6px;
                margin:8px 0;
            }

            #jkl-igb button.action {
                border:1px solid #454545;
                background:#242424;
                color:#fff;
                border-radius:8px;
                padding:7px 8px;
                cursor:pointer;
            }

            #jkl-igb button.action:disabled {
                opacity:.45;
            }

            #jkl-igb #jkl-sync {
                border-color:#3a8b5d;
                background:#183324;
            }

            #jkl-igb .status {
                inline-size:100%;
                min-inline-size:0;
                max-inline-size:100%;
                contain:inline-size;
                overflow:hidden;
                margin:7px 0;
                padding:7px 8px;
                background:#191919;
                border-radius:7px;
            }

            .status[data-level=ok] {
                color:#80dca5;
            }

            .status[data-level=warn] {
                color:#ffd27a;
            }

            .status[data-level=error] {
                color:#ff8585;
            }

            .status[data-level=cancel] {
                color:#ff8fc7;
            }

            #jkl-igb .dashboard {
                display:grid;
                grid-template-columns:minmax(0,1fr);
                inline-size:100%;
                max-inline-size:100%;
                gap:8px;
                margin:8px 0;
            }

            #jkl-igb .progress-card,
            #jkl-igb .jkl-compact-card {
                inline-size:100%;
                min-inline-size:0;
                max-inline-size:100%;
                contain:inline-size;
                overflow:hidden;
                border:1px solid #303030;
                border-radius:9px;
                background:#171717;
                padding:8px 9px;
            }

            #jkl-igb .progress-head,
            #jkl-igb .jkl-card-head {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:8px;
                margin-bottom:6px;
            }

            #jkl-igb .progress-head span,
            #jkl-igb .jkl-card-head span {
                color:#a9a9a9;
                font-size:10px;
                font-weight:700;
                letter-spacing:.7px;
            }

            #jkl-igb .progress-head b,
            #jkl-igb .jkl-card-head b {
                color:#fff;
                font-size:12px;
            }

            #jkl-igb .progress-track {
                position:relative;
                height:8px;
                overflow:hidden;
                border-radius:999px;
                background:#292929;
                box-shadow:inset 0 0 0 1px rgba(255,255,255,.025);
            }

            #jkl-igb .progress-fill {
                position:absolute;
                inset:0 auto 0 0;
                width:0;
                border-radius:inherit;
                background:linear-gradient(90deg,#3c8d67,#63c793);
                transition:width .22s ease;
            }

            #jkl-igb .progress-fill.discovery {
                background:linear-gradient(90deg,#476baf,#72a2ff);
            }

            #jkl-igb .progress-fill.phase {
                background:linear-gradient(90deg,#9a6b35,#e0a458);
            }

            #jkl-igb .progress-fill.download {
                background:linear-gradient(90deg,#6e54a3,#a883e8);
            }

            #jkl-igb .progress-fill.indeterminate::after {
                content:'';
                position:absolute;
                inset:0;
                background:linear-gradient(
                    90deg,
                    transparent 0%,
                    rgba(255,255,255,.26) 50%,
                    transparent 100%
                );
                transform:translateX(-100%);
                animation:jkl-progress-sweep 1.1s linear infinite;
            }

            @keyframes jkl-progress-sweep {
                to { transform:translateX(100%); }
            }

            #jkl-igb .progress-detail {
                display:block;
                inline-size:100%;
                min-inline-size:0;
                max-inline-size:100%;
                contain:inline-size;
                margin-top:5px;
                color:#9d9d9d;
                font-size:10px;
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
            }

            #jkl-igb .stats {
                display:grid;
                grid-template-columns:minmax(0,1fr);
                inline-size:100%;
                max-inline-size:100%;
                gap:8px;
                margin:0;
                color:#bbb;
            }

            #jkl-igb .stats b {
                color:#fff;
            }

            #jkl-igb .jkl-metrics {
                display:grid;
                grid-template-columns:repeat(
                    3,
                    minmax(0,1fr)
                );
                gap:6px;
            }

            #jkl-igb .metric {
                display:flex;
                flex-direction:column;
                gap:2px;
                min-width:0;
                padding:7px 8px;
                border:1px solid #2e2e2e;
                border-radius:8px;
                background:#151515;
            }

            #jkl-igb .metric span {
                color:#888;
                font-size:9px;
                font-weight:700;
                letter-spacing:.6px;
            }

            #jkl-igb .metric b {
                font-size:14px;
                line-height:1.1;
                overflow:hidden;
                text-overflow:ellipsis;
            }

            #jkl-igb .jkl-card-line {
                display:flex;
                flex-wrap:wrap;
                gap:4px 11px;
                color:#9c9c9c;
                font-size:10px;
            }

            #jkl-igb .jkl-state.ok { color:#80dca5; }
            #jkl-igb .jkl-state.warn { color:#ffd27a; }
            #jkl-igb .jkl-state.neutral { color:#aaa; }

            #jkl-igb details.dashboard-details,
            #jkl-igb details.log-tools {
                margin-top:7px;
                border:1px solid #303030;
                border-radius:8px;
                background:#151515;
                overflow:hidden;
            }

            #jkl-igb details.dashboard-details > summary,
            #jkl-igb details.log-tools > summary {
                padding:7px 9px;
                cursor:pointer;
                color:#999;
                font-size:10px;
                font-weight:700;
                letter-spacing:.6px;
                user-select:none;
            }

            #jkl-igb .diagnostics {
                display:grid;
                grid-template-columns:minmax(0,1fr);
                inline-size:100%;
                max-inline-size:100%;
                gap:4px;
                padding:7px 9px 9px;
                border-top:1px solid #2d2d2d;
            }

            #jkl-igb .diag-row {
                display:flex;
                justify-content:space-between;
                gap:10px;
                color:#929292;
                font-size:10px;
            }

            #jkl-igb .diag-row b {
                color:#ddd;
                text-align:right;
            }

            #jkl-igb .diag-row b.warn {
                color:#ffd27a;
            }

            #jkl-igb .diag-separator {
                height:1px;
                margin:3px 0;
                background:#2b2b2b;
            }

            #jkl-igb .tools {
                display:flex;
                flex-wrap:wrap;
                gap:5px;
                margin-top:7px;
            }

            #jkl-igb .tools button {
                flex:1 1 45%;
            }

            #jkl-igb .primary-tools #jkl-folder {
                flex:1 1 100%;
            }

            #jkl-igb details.advanced-tools {
                margin-top:7px;
                padding:0;
                border:1px solid #333;
                border-radius:8px;
                background:#151515;
            }

            #jkl-igb details.advanced-tools > summary {
                padding:7px 9px;
                cursor:pointer;
                color:#aaa;
                user-select:none;
            }

            #jkl-igb details.advanced-tools[open] > summary {
                border-bottom:1px solid #2f2f2f;
                color:#ddd;
            }

            #jkl-igb .advanced-inner {
                padding:7px;
            }

            #jkl-igb .advanced-inner .tools {
                margin-top:0;
            }

            #jkl-igb .advanced-inner label {
                margin-top:6px;
            }

            #jkl-igb .log {
                inline-size:100%;
                min-inline-size:0;
                max-inline-size:100%;
                contain:inline-size;
                height:160px;
                overflow-x:hidden;
                overflow-y:auto;
                padding:7px;
                margin-top:0;
                border:0;
                border-top:1px solid #2d2d2d;
                border-radius:7px;
                background:#090909;
                color:#aaa;
                font:10px/1.35 Consolas,monospace;
            }

            #jkl-igb .jkl-ok {
                color:#80dca5;
            }

            #jkl-igb .jkl-warn {
                color:#ffd27a;
            }

            #jkl-igb .jkl-error {
                color:#ff8585;
            }

            #jkl-igb .jkl-cancel {
                color:#ff8fc7;
            }

            #jkl-igb.mini {
                width:118px;
                border-radius:24px;
            }

            #jkl-igb.mini .body {
                display:none;
            }

            #jkl-igb .jkl-title-mini {
                display:none;
            }

            #jkl-igb.mini .jkl-title-full {
                display:none;
            }

            #jkl-igb.mini .jkl-title-mini {
                display:inline;
                font-size:11px;
                color:#f5f5f5;
            }

            #jkl-igb #jkl-mini-progress {
                margin-left:4px;
                color:#80dca5;
                font-size:10px;
            }

            #jkl-igb.mini header {
                padding:8px 10px;
                border-bottom:0;
            }

            .jkl-single-download,
            #jkl-current-download {
                display:flex;
                align-items:center;
                justify-content:center;
                padding:0;
                cursor:pointer;
            }

            .jkl-single-download svg,
            #jkl-current-download svg {
                width:19px;
                height:19px;
                pointer-events:none;
            }

            .jkl-single-download {
                position:absolute;
                z-index:30;
                top:8px;
                right:8px;
                width:34px;
                height:34px;
                border:1px solid rgba(255,255,255,.28);
                border-radius:50%;
                background:rgba(15,15,15,.82);
                color:#fff;
                box-shadow:0 2px 10px rgba(0,0,0,.35);
                backdrop-filter:blur(4px);
                opacity:.82;
                transition:opacity .15s ease, transform .15s ease;
                cursor:pointer;
            }

            [data-jkl-single-host="1"]:hover > .jkl-single-download,
            .jkl-single-download:hover,
            .jkl-single-download:focus-visible {
                opacity:1;
                transform:scale(1.04);
            }

            #jkl-current-download.jkl-media-download-overlay {
                position:fixed;
                z-index:2147483645;
                top:10px;
                left:10px;
                right:auto;
                width:36px;
                height:36px;
                border:1px solid rgba(255,255,255,.30);
                border-radius:50%;
                background:rgba(15,15,15,.84);
                color:#fff;
                box-shadow:0 2px 10px rgba(0,0,0,.38);
                backdrop-filter:blur(4px);
                opacity:.78;
                transition:opacity .15s ease,
                    transform .15s ease;
            }
            #jkl-current-download.jkl-media-download-overlay:hover,
            #jkl-current-download.jkl-media-download-overlay:focus-visible {
                opacity:1;
                transform:scale(1.04);
            }
            #jkl-current-download.jkl-media-download-overlay:active {
                transform:scale(.96);
            }

            .jkl-single-download.busy,
            #jkl-current-download.busy {
                cursor:progress;
            }

            .jkl-single-download.ok,
            #jkl-current-download.ok {
                color:#80dca5;
            }

            .jkl-single-download.error,
            #jkl-current-download.error {
                color:#ff8585;
            }

            @media (hover:none) {
                .jkl-single-download {
                    opacity:.88;
                }
            }
        `);

        const b =
            document.createElement(
                'section'
            );

        b.id =
            'jkl-igb';

        b.innerHTML = `
            <header>
                <b>
                    <span class="jkl-title-full">
                        ${APP.NAME}
                        <span style="color:#777">
                            v${APP.VERSION}
                        </span>
                    </span>

                    <span class="jkl-title-mini">
                        JKL IG
                        <span id="jkl-mini-progress"></span>
                    </span>
                </b>

                <button
                    id="jkl-toggle"
                    title="Minimiser la fenêtre"
                >
                    −
                </button>
            </header>

            <div class="body">
                <input
                    id="jkl-user"
                    type="text"
                    placeholder="Instagram username"
                >

                <div
                    id="jkl-user-info"
                    style="color:#aaa;margin:5px 1px 7px"
                ></div>

                <div class="checks">
                    <label>
                        <input id="jkl-post" type="checkbox">
                        POST
                    </label>

                    <label>
                        <input id="jkl-reel" type="checkbox">
                        REEL
                    </label>

                    <label>
                        <input id="jkl-story" type="checkbox">
                        STORY
                    </label>

                    <label>
                        <input id="jkl-highlight" type="checkbox">
                        HIGHLIGHT
                    </label>

                    <label>
                        <input id="jkl-tagged" type="checkbox">
                        TAGGED
                    </label>

                    <label>
                        <input id="jkl-avatar" type="checkbox">
                        AVATAR
                    </label>
                </div>

                <div class="buttons">
                    <button
                        class="action"
                        id="jkl-scan"
                    >
                        1. SCAN
                    </button>

                    <button
                        class="action"
                        id="jkl-download"
                    >
                        2. DOWNLOAD MISSING
                    </button>

                    <button
                        class="action"
                        id="jkl-download-accessible"
                        title="Save only identity- and source-verified public POST, HIGHLIGHT, STORY and AVATAR files. REELS, TAGGED and subscriber media are excluded. The scan remains INCOMPLETE."
                    >
                        DOWNLOAD VERIFIED ACCESSIBLE (PARTIAL)
                    </button>

                    <button
                        class="action"
                        id="jkl-download-authorized"
                        title="Save only authenticated subscriber media already verified by media-info. This is NOT a COMPLETE profile backup."
                    >
                        DOWNLOAD SUBSCRIBER VERIFIED (PARTIAL)
                    </button>

                    <button
                        class="action"
                        id="jkl-sync"
                    >
                        SCAN + DOWNLOAD
                    </button>

                    <button
                        class="action"
                        id="jkl-cancel"
                        disabled
                    >
                        CANCEL
                    </button>
                </div>

                <div class="tools" style="margin:7px 0 3px">
                    <button
                        class="action"
                        type="button"
                        id="jkl-single-current"
                        title="Télécharger uniquement le média ouvert, sans scan global"
                        disabled
                    >
                        DOWNLOAD OPEN MEDIA (SOLO)
                    </button>
                </div>
                <div
                    id="jkl-single-target"
                    style="color:#aaa;font-size:10px;overflow-wrap:anywhere;margin-bottom:6px"
                >Ouvre un POST, un REEL ou une STORY</div>

                <div
                    id="jkl-status"
                    class="status"
                >
                    Ready.
                </div>

                <div class="dashboard">
                    <div class="progress-card">
                        <div class="progress-head">
                            <span>GLOBAL SCAN</span>
                            <b id="jkl-global-value">0.0%</b>
                        </div>

                        <div class="progress-track">
                            <div
                                id="jkl-global-fill"
                                class="progress-fill"
                            ></div>
                        </div>

                        <div
                            id="jkl-global-detail"
                            class="progress-detail"
                        >
                            Ready
                        </div>
                    </div>

                    <div class="progress-card">
                        <div class="progress-head">
                            <span id="jkl-phase-label">CURRENT PHASE</span>
                            <b id="jkl-phase-value">—</b>
                        </div>

                        <div class="progress-track">
                            <div
                                id="jkl-phase-fill"
                                class="progress-fill phase"
                            ></div>
                        </div>

                        <div
                            id="jkl-phase-detail"
                            class="progress-detail"
                        >
                            Idle
                        </div>
                    </div>

                    <div class="progress-card">
                        <div class="progress-head">
                            <span>DISCOVERY</span>
                            <b id="jkl-discovery-value">—</b>
                        </div>

                        <div class="progress-track">
                            <div
                                id="jkl-discovery-fill"
                                class="progress-fill discovery"
                            ></div>
                        </div>

                        <div
                            id="jkl-discovery-detail"
                            class="progress-detail"
                        >
                            0 owned roots · baseline unavailable
                        </div>
                    </div>

                    <div class="progress-card">
                        <div class="progress-head">
                            <span>DOWNLOAD</span>
                            <b id="jkl-download-value">—</b>
                        </div>

                        <div class="progress-track">
                            <div
                                id="jkl-download-fill"
                                class="progress-fill download"
                            ></div>
                        </div>

                        <div
                            id="jkl-download-detail"
                            class="progress-detail"
                        >
                            Idle
                        </div>
                    </div>

                    <div
                        id="jkl-stats"
                        class="stats"
                    ></div>
                </div>

                <div class="tools primary-tools">
                    <button
                        class="action"
                        id="jkl-folder"
                    >
                        SCAN LOCAL FOLDER
                    </button>
                </div>

                <details class="dashboard-details">
                    <summary>DIAGNOSTICS</summary>

                    <div
                        id="jkl-diagnostics"
                        class="diagnostics"
                    ></div>
                </details>

                <details class="advanced-tools">
                    <summary>ADVANCED TOOLS</summary>

                    <div class="advanced-inner">
                        <div class="tools">
                            <button
                                class="action"
                                id="jkl-dl-diag"
                            >
                                DL DIAG 20 IMAGES
                            </button>

                            <button
                                class="action"
                                id="jkl-export"
                            >
                                EXPORT MANIFEST
                            </button>

                            <button
                                class="action"
                                id="jkl-reset"
                            >
                                RESET LEDGER
                            </button>
                        </div>

                        <label>
                            <input
                                id="jkl-force"
                                type="checkbox"
                            >
                            Force redownload everything
                        </label>

                        <label>
                            <input
                                id="jkl-debug"
                                type="checkbox"
                            >
                            Debug console logs
                        </label>
                    </div>
                </details>

                <details class="log-tools">
                    <summary>LOGS</summary>

                    <div class="tools" style="margin:6px 0">
                        <button
                            class="action"
                            type="button"
                            id="jkl-export-logs"
                            title="Exporter tout le journal de cette session, même les lignes masquées par la limite d'affichage"
                        >
                            EXPORT LOGS (.TXT)
                        </button>
                        <span
                            id="jkl-log-counter"
                            style="font-size:10px;color:#aaa"
                        >0 visible / 0 archivées</span>
                    </div>

                    <div
                        id="jkl-log"
                        class="log"
                    ></div>
                </details>

                <div
                    style="color:#777;font-size:9px;margin-top:6px;text-align:center"
                >
                    USERNAME - TYPE - YYYY_MM_DD - MEDIA_ID.ext
                </div>

                <input
                    id="jkl-folder-input"
                    type="file"
                    webkitdirectory
                    directory
                    multiple
                    hidden
                >

            </div>
        `;

        document.body.appendChild(b);

        ui = {
            box: b,

            username:
                b.querySelector(
                    '#jkl-user'
                ),

            userInfo:
                b.querySelector(
                    '#jkl-user-info'
                ),

            cbPost:
                b.querySelector(
                    '#jkl-post'
                ),

            cbReel:
                b.querySelector(
                    '#jkl-reel'
                ),

            cbStory:
                b.querySelector(
                    '#jkl-story'
                ),

            cbHighlight:
                b.querySelector(
                    '#jkl-highlight'
                ),

            cbTagged:
                b.querySelector(
                    '#jkl-tagged'
                ),

            cbAvatar:
                b.querySelector(
                    '#jkl-avatar'
                ),

            scan:
                b.querySelector(
                    '#jkl-scan'
                ),

            singleCurrent:
                b.querySelector('#jkl-single-current'),

            singleTarget:
                b.querySelector('#jkl-single-target'),

            download:
                b.querySelector(
                    '#jkl-download'
                ),

            downloadAccessible:
                b.querySelector(
                    '#jkl-download-accessible'
                ),

            downloadAuthorized:
                b.querySelector(
                    '#jkl-download-authorized'
                ),

            sync:
                b.querySelector(
                    '#jkl-sync'
                ),

            cancel:
                b.querySelector(
                    '#jkl-cancel'
                ),

            status:
                b.querySelector(
                    '#jkl-status'
                ),

            globalFill:
                b.querySelector(
                    '#jkl-global-fill'
                ),

            globalValue:
                b.querySelector(
                    '#jkl-global-value'
                ),

            globalDetail:
                b.querySelector(
                    '#jkl-global-detail'
                ),

            phaseLabel:
                b.querySelector(
                    '#jkl-phase-label'
                ),

            phaseFill:
                b.querySelector(
                    '#jkl-phase-fill'
                ),

            phaseValue:
                b.querySelector(
                    '#jkl-phase-value'
                ),

            phaseDetail:
                b.querySelector(
                    '#jkl-phase-detail'
                ),

            discoveryFill:
                b.querySelector(
                    '#jkl-discovery-fill'
                ),

            discoveryValue:
                b.querySelector(
                    '#jkl-discovery-value'
                ),

            discoveryDetail:
                b.querySelector(
                    '#jkl-discovery-detail'
                ),

            downloadFill:
                b.querySelector(
                    '#jkl-download-fill'
                ),

            downloadValue:
                b.querySelector(
                    '#jkl-download-value'
                ),

            downloadDetail:
                b.querySelector(
                    '#jkl-download-detail'
                ),

            miniProgress:
                b.querySelector(
                    '#jkl-mini-progress'
                ),

            stats:
                b.querySelector(
                    '#jkl-stats'
                ),

            diagnostics:
                b.querySelector(
                    '#jkl-diagnostics'
                ),

            log:
                b.querySelector(
                    '#jkl-log'
                ),

            exportLogs:
                b.querySelector('#jkl-export-logs'),

            logCounter:
                b.querySelector('#jkl-log-counter'),

            folder:
                b.querySelector(
                    '#jkl-folder-input'
                ),

            folderButton:
                b.querySelector(
                    '#jkl-folder'
                ),

            dlDiag:
                b.querySelector(
                    '#jkl-dl-diag'
                ),

            exportManifest:
                b.querySelector(
                    '#jkl-export'
                ),

            resetLedger:
                b.querySelector(
                    '#jkl-reset'
                ),

            force:
                b.querySelector(
                    '#jkl-force'
                ),

            debug:
                b.querySelector(
                    '#jkl-debug'
                ),
        };

        ui.username.value =
            currentProfile();

        bind(
            ui.cbPost,
            'includePost'
        );

        bind(
            ui.cbReel,
            'includeReel'
        );

        bind(
            ui.cbStory,
            'includeStory'
        );

        bind(
            ui.cbHighlight,
            'includeHighlight'
        );

        bind(
            ui.cbTagged,
            'includeTagged'
        );

        bind(
            ui.cbAvatar,
            'includeAvatar'
        );

        bind(
            ui.force,
            'force'
        );

        bind(
            ui.debug,
            'debug'
        );

        ui.username.addEventListener(
            'input',
            () => {
                if (
                    state.scanPlan &&
                    !state.running &&
                    cleanUser(ui.username.value) !== cleanUser(state.username)
                ) {
                    invalidateCompletedScan('PROFILE_INPUT_CHANGED');
                    status(
                        'Profile input changed: run SCAN again before downloading.',
                        'warn'
                    );

                    resetScanProgress(
                        currentScanSelection()
                    );
                    updateStats();
                }
            }
        );

        ui.scan.onclick =
            scanAll;

        ui.singleCurrent.onclick = handlePanelSingleDownload;

        ui.download.onclick =
            () => downloadMissing(DOWNLOAD_MODE.COMPLETE);

        ui.downloadAuthorized.onclick =
            () => downloadMissing(DOWNLOAD_MODE.SUBSCRIBER);

        ui.downloadAccessible.onclick =
            () => downloadMissing(DOWNLOAD_MODE.ACCESSIBLE);

        ui.sync.onclick =
            syncAll;

        ui.cancel.onclick =
            cancel;

        ui.folderButton.onclick =
            () => {
                if (!ui.folder.disabled) {
                    ui.folder.click();
                }
            };

        ui.dlDiag.onclick =
            runDownloadDiagnostic;

        ui.exportManifest.onclick =
            exportManifest;

        ui.exportLogs.onclick =
            exportLogs;

        ui.resetLedger.onclick =
            resetLedger;

        const panelController =
            installPanelController(
                b
            );

        b.querySelector(
            '#jkl-toggle'
        ).onclick =
            () => {
                panelController
                    .toggleMini();
            };

        ui.folder.onchange =
            () => {
                if (
                    ui.folder
                        .files
                        ?.length
                ) {
                    indexFolder(
                        ui.folder.files
                    );
                }

                ui.folder.value = '';
            };


        resetScanProgress(
            currentScanSelection()
        );
        updateStats();
    }

    GM_registerMenuCommand(
        `${APP.NAME}: toggle panel`,
        () => {
            if (ui.box) {
                ui.box.style.display =
                    ui.box.style.display ===
                        'none'
                        ? ''
                        : 'none';
            }
        }
    );

    GM_registerMenuCommand(
        `${APP.NAME}: scan current profile`,
        () =>
            scanAll()
    );

    GM_registerMenuCommand(
        `${APP.NAME}: DL diagnostic 20 images`,
        () =>
            runDownloadDiagnostic()
    );

    function init() {
        if (!document.body) {
            setTimeout(
                init,
                100
            );

            return;
        }

        if (
            document.getElementById(
                'jkl-igb'
            )
        ) {
            return;
        }

        createUi();
        installSingleDownloadUi();

        const u =
            currentProfile();

        if (u) {
            log(
                `Profile detected from URL: @${u}`
            );
        }

        log(
            `${APP.NAME} v${APP.VERSION} ready.`
        );
    }

    installSingleDownloadEvents();
    init();
})();