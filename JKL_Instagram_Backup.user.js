// ==UserScript==
// @name         JKL Instagram Backup
// @namespace    https://jkl.local/
// @version      1.5.61
// @description  Instagram archive hardened: exhaustive accessible scan, immutable completeness guard, anti-loss local archive, feedback circuit breaker.
// @author       JKL
// @homepageURL  https://github.com/JKL93sang/JKL-Instagram-Backup
// @supportURL   https://github.com/JKL93sang/JKL-Instagram-Backup/issues
// @source       https://github.com/JKL93sang/JKL-Instagram-Backup/blob/main/JKL_Instagram_Backup.user.js
// @updateURL    https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/main/JKL_Instagram_Backup.user.js
// @downloadURL  https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/main/JKL_Instagram_Backup.user.js
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
        NAME: 'JKL Instagram Backup', VERSION: '1.5.61', TZ: 'Europe/Paris',
        DB: 'JKL_IG_BACKUP_DB_V1', SETTINGS: 'JKL_IG_BACKUP_SETTINGS_V1',
        APP_ID: '936619743392459', ASBD_ID: '359341',
        SCROLL_MIN: 3000, SCROLL_MAX: 5500, PROFILE_SCROLL_MIN: 450, PROFILE_SCROLL_MAX: 3200, PROFILE_SCROLL_POLL: 160, PROFILE_MAX_SCROLLS: 200, REEL_MAX_SCROLLS: 5000, TAGGED_MAX_PAGES: 5000,
        REEL_SCROLL_MIN: 350, REEL_SCROLL_MAX: 1600, REEL_SCROLL_POLL: 120,
        PAGE_MIN: 650, PAGE_MAX: 1250, SHADOW_PAGE_MIN: 250, SHADOW_PAGE_MAX: 450, SHADOW_MAX_PAGES: 200, DOWNLOAD_DELAY: 0, DOWNLOAD_WORKERS: 1, DOWNLOAD_RETRIES: 3, LEDGER_FLUSH_EVERY: 25, DL_DIAG_SAMPLES: 20, MAX_LOG: 300,
        HYDRATE_MIN: 180, HYDRATE_MAX: 320, HYDRATE_RETRIES: 3, HYDRATE_WORKERS: 4, HYDRATE_LARGE_THRESHOLD: 250, HYDRATE_LARGE_WORKERS: 2, HYDRATE_BULK_THRESHOLD: 100, HYDRATE_BULK_SIZE: 20, HYDRATE_SINGLE_FALLBACK_CAP: 100,
        PROFILE_FALLBACK_DOC: '8363144743749214', REEL_FALLBACK_DOC: '34185899317723021', TAGGED_FALLBACK_DOC: '28390247837269928',
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
        },

        hydration: {
            totalRoots: 0,
            hydratedRoots: 0,
            diskSatisfiedRoots: 0,
            failedRoots: 0,
            filesBefore: 0,
            filesAfter: 0,
        },

        rootCatalog: new Map(),
        queue: new Map(),

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
        diskHidden: new Set(),
        diskStoryHighlight: new Set(),
        legacy: new Map(),


        downloaded: 0,
        hiddenCopiesDownloaded: 0,
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

        reelsByUserId: new Map(),
        reelPageInfo: new Map(),

        taggedDocInitial: '',
        taggedDocConnection: '',
        taggedNativeVariables: null,
        taggedInitialData: null,
        taggedInitialUserId: '',

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

    const UI_STATE_KEY = 'JKL_IG_BACKUP_UI_V1';

    const singleDownloadState = {
        busy: new Set(),
        observer: null,
        timer: 0,
        eventsInstalled: false,
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

    function gmRequest(options) {
        return new Promise((resolve, reject) => {
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

            GM_xmlhttpRequest({
                timeout: 30000,
                ...request,
                onload: response => {
                    const url = String(request.url || '');
                    const headersText = String(response?.responseHeaders || '');
                    const apiLike =
                        /(^|\.)instagram\.com\/api\//i.test(url) ||
                        /(^|\.)instagram\.com\/graphql/i.test(url) ||
                        /content-type:\s*(?:application|text)\/(?:json|javascript)/i.test(headersText);

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
                        /(^|\.)instagram\.com(?:\/|$)/i.test(url)
                    ) {
                        reject(
                            rateLimitCircuitBreak(
                                `${feedbackLabel}: Instagram returned HTTP 429.`
                            )
                        );
                        return;
                    }

                    if (
                        feedbackCheck &&
                        apiLike &&
                        feedbackRequiredIn(payload)
                    ) {
                        reject(
                            feedbackCircuitBreak(
                                `${feedbackLabel}: Instagram returned feedback_required.`
                            )
                        );
                        return;
                    }

                    resolve(response);
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
                    reject(e);
                },
                ontimeout: () => {
                    const e = new Error('GM request timeout');
                    e.code = 'GM_TIMEOUT';
                    reject(e);
                },
            });
        });
    }

    function feedbackRequiredIn(value) {
        if (value == null) {
            return false;
        }

        const text =
            typeof value === 'string'
                ? value
                : (() => {
                    try {
                        return JSON.stringify(value);
                    }
                    catch {
                        return String(value);
                    }
                })();

        return /feedback_required/i.test(text);
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

        if (!state.running && state.scanOutcome === 'COMPLETE') {
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
        let hidden = 0;

        for (const m of mediaList) {
            if (!existingReason(m)) {
                main++;
            }

            if (
                isHiddenMedia(m) &&
                !hiddenCopyExistingReason(m)
            ) {
                hidden++;
            }
        }

        return {
            main,
            hidden,
            total: main + hidden,
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

    function invalidateCompletedScan(reason = 'SCAN_INVALIDATED') {
        if (!state.scanPlan) {
            return;
        }

        state.scanComplete = false;
        state.scanOutcome = reason;
        state.scanUserId = '';
        state.scanQueueSize = 0;
        state.scanQueueFingerprint = '';
    }

    function resetCoverage() {
        for (const key of Object.keys(state.coverage)) {
            state.coverage[key] = false;
        }

        state.shadow.applicable = true;
        state.shadow.reason = '';
        state.shadow.totalRoots = 0;
        state.shadow.postRoots = 0;
        state.shadow.extras = 0;
        state.shadow.pages = 0;

        state.hidden.pages = 0;
        state.hidden.candidates = 0;
        state.hidden.alreadyOwned = 0;
        state.hidden.recovered = 0;
        state.hidden.previewOnly = 0;
        state.hidden.failed = 0;
        state.hidden.recoveredCodes = [];

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

    function incompleteCoverage() {
        return requiredCoverage()
            .filter(([, key]) => !state.coverage[key])
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
        return (
            hiddenDiscoverySources(m)
                .length > 0
        );
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

    function recordDownloaded(m) {
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
            hiddenDiscovery:
                hiddenDiscoverySources(m),
            downloadedAt:
                new Date().toISOString(),
        };

        state.ledgerDirty++;

        flushLedger(false);
    }

    function recordHiddenDownloaded(m) {
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
            hiddenDiscovery:
                hiddenDiscoverySources(m),
            hiddenCopyDownloadedAt:
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

    function highlightRawTitle(m) {
        if (m?.type !== 'HIGHLIGHT') {
            return '';
        }

        for (const source of m?.sources || []) {
            const s =
                String(
                    source ||
                    ''
                );

            if (
                s.startsWith(
                    'HIGHLIGHT:'
                )
            ) {
                return (
                    s.slice(
                        'HIGHLIGHT:'.length
                    ) ||
                    'Highlight'
                );
            }
        }

        return 'Highlight';
    }

    function highlightFolderTitle(m) {
        return sanitizePathComponent(
            highlightRawTitle(m),
            'Highlight',
            80
        );
    }

    function highlightFallbackFolderTitle(m) {
        const raw =
            highlightRawTitle(m);

        const suffix =
            hash(raw)
                .toString(16)
                .padStart(8, '0');

        return (
            `Highlight_${suffix}`
        );
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

        if (options?.hiddenCopy) {
            return [
                user,
                sanitizePathComponent(
                    `${user} - HIDDEN`,
                    'HIDDEN',
                    96
                ),
                String(
                    m?.filename ||
                    filename(m)
                ),
            ].join('/');
        }

        const folderType =
            sanitizePathComponent(
                ({
                    POST: 'POSTS',
                    REEL: 'REELS',
                    HIGHLIGHT: 'HIGHLIGHTS',
                    STORY: 'STORIES',
                    TAGGED: 'TAGGED',
                    AVATAR: 'AVATAR',
                })[rawType] ||
                rawType,
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
            const title =
                options?.safeHighlightFallback
                    ? highlightFallbackFolderTitle(m)
                    : highlightFolderTitle(m);

            parts.push(
                sanitizePathComponent(
                    `${user} - ${title}`,
                    `${user} - Highlight`,
                    120
                )
            );
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

    function bestImage(x) {
        const c =
            x?.image_versions2?.candidates ||
            x?.display_resources ||
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
                    })
                )
                .filter(v => v.u)
                .sort(
                    (a, b) =>
                        b.a - a.a
                )[0]
                ?.u || '';
        }

        return (
            x?.display_url ||
            x?.thumbnail_url ||
            x?.profile_pic_url_hd ||
            x?.profile_pic_url ||
            ''
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
        source = ''
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
                    : bestImage(child);

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

                old.rootIds ||= new Set();

                if (rootId) {
                    old.rootIds.add(
                        String(rootId)
                    );
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

    async function fetchOwnedMediaInfo(rootId, label = 'OWNED media') {
        const id = String(rootId || '');

        if (!/^\d+$/.test(id)) {
            throw new Error(`${label}: invalid root ID ${id || '-'}`);
        }

        const endpoints = [
            `https://i.instagram.com/api/v1/media/${id}/info/`,
            `https://www.instagram.com/api/v1/media/${id}/info/`,
        ];

        let last = null;

        for (let attempt = 1; attempt <= APP.HYDRATE_RETRIES; attempt++) {
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
                            'User-Agent': APP.MOBILE_UA,
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

            if (attempt < APP.HYDRATE_RETRIES) {
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

    function rootHasHiddenDiscovery(rec) {
        const sources =
            rec?.sources instanceof Set
                ? rec.sources
                : new Set(
                    Array.isArray(rec?.sources)
                        ? rec.sources
                        : []
                );

        for (const source of sources) {
            if (
                HIDDEN_DISCOVERY_SOURCES.has(
                    String(source)
                )
            ) {
                return true;
            }
        }

        return false;
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
            if (
                !state.diskCanonical.has(
                    unitId
                )
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

        /*
         * HIDDEN discovery itself is never skipped. This function runs only
         * after PUBLIC SHADOW / CONNECTED HIDDEN. If a HIDDEN duplicate is
         * missing, an URL must already be queued for that exact unit; otherwise
         * deep hydration remains mandatory so the duplicate can still be made.
         */
        if (rootHasHiddenDiscovery(rec)) {
            for (const unitId of unitIds) {
                if (
                    state.diskHidden.has(
                        unitId
                    )
                ) {
                    continue;
                }

                const media =
                    state.queue.get(
                        unitId
                    );

                if (
                    !media ||
                    !media?.rootIds?.has?.(
                        String(rec.id)
                    ) ||
                    !isHiddenMedia(media) ||
                    !media.url
                ) {
                    return false;
                }
            }
        }

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
        return keyedConnection(data, TAGGED_CONNECTION_KEY) ||
            connection(data, TAGGED_CONNECTION_KEY);
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
        if (
            !GRID_NAMES.has(
                String(
                    meta?.friendly ||
                    ''
                )
            ) ||
            !requestTargetsCurrentProfile(
                meta
            )
        ) {
            return;
        }

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
                GRID_NAMES.has(String(meta.friendly || ''))
            ) {
                try {
                    const verifiedContract = {
                        docId:String(meta.docId),
                        friendly:String(meta.friendly),
                        endpoint:meta.endpoint === 'api' ? 'api' : 'query',
                        variables:JSON.parse(JSON.stringify(meta.variables)),
                        template:{
                            body:JSON.parse(JSON.stringify(meta.bodyFields || {})),
                            headers:JSON.parse(JSON.stringify(meta.relayHeaders || {})),
                        },
                    };
                    net.gridQueryByUser.set(user,verifiedContract);

                    if (observedCursor) {
                        // Keep a successful native continuation distinct
                        // from any later initial-page reentry request.
                        net.gridNativeContinuationByUser.set(
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

    function captureReels(
        data,
        meta
    ) {
        const uid =
            reelUserId(meta) ||
            state.userId;

        if (!uid) {
            return;
        }

        const c =
            reelConn(data);

        if (!c) {
            return;
        }

        const map =
            net.reelsByUserId.get(uid) ||
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

        net.reelsByUserId.set(
            uid,
            map
        );

        net.reelPageInfo.set(
            uid,
            c.page_info || null
        );
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

                            if (
                                TAGGED_NAMES.has(m.friendly) &&
                                m.docId
                            ) {
                                if (
                                    m.friendly ===
                                    'PolarisProfileTaggedTabContentQuery_connection'
                                ) {
                                    net.taggedDocConnection =
                                        String(m.docId);
                                }
                                else {
                                    net.taggedDocInitial =
                                        String(m.docId);
                                }

                                if (
                                    m.variables &&
                                    typeof m.variables === 'object'
                                ) {
                                    try {
                                        net.taggedNativeVariables =
                                            JSON.parse(
                                                JSON.stringify(
                                                    m.variables
                                                )
                                            );
                                    }
                                    catch {}
                                }
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
                                            !!keyedConnection(data, TAGGED_CONNECTION_KEY) ||
                                            !!connection(data, TAGGED_CONNECTION_KEY);
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

                                        if (
                                            TAGGED_NAMES.has(m.friendly) &&
                                            hasTaggedConnection &&
                                            targetsProfile
                                        ) {
                                            net.taggedInitialData =
                                                data;
                                            net.taggedInitialUserId =
                                                String(state.userId || '');
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
                        TAGGED_NAMES.has(meta.friendly) &&
                        meta.docId
                    ) {
                        if (
                            meta.friendly ===
                            'PolarisProfileTaggedTabContentQuery_connection'
                        ) {
                            net.taggedDocConnection =
                                String(meta.docId);
                        }
                        else {
                            net.taggedDocInitial =
                                String(meta.docId);
                        }

                        if (
                            meta.variables &&
                            typeof meta.variables === 'object'
                        ) {
                            try {
                                net.taggedNativeVariables =
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
                                        !!keyedConnection(data, TAGGED_CONNECTION_KEY) ||
                                        !!connection(data, TAGGED_CONNECTION_KEY);
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

                                    if (
                                        TAGGED_NAMES.has(meta.friendly) &&
                                        hasTaggedConnection &&
                                        targetsProfile
                                    ) {
                                        net.taggedInitialData =
                                            data;
                                        net.taggedInitialUserId =
                                            String(state.userId || '');
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

                if (feedbackRequiredIn(text)) {
                    throw feedbackCircuitBreak(
                        `${label}: Instagram returned feedback_required.`
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
                `subscribers=${state.exclusive.subscriberCount ?? '-'}.`
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
                    state.coverage[key] ===
                    true
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
        let hiddenTotal = 0;
        let hiddenExisting = 0;

        for (const m of state.queue.values()) {
            if (existingReason(m)) {
                existing++;
            }
            else {
                pending++;
            }

            if (isHiddenMedia(m)) {
                hiddenTotal++;

                if (hiddenCopyExistingReason(m)) {
                    hiddenExisting++;
                }
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
            state.scanOutcome === 'COMPLETE'
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
            downloadValue = 'LOCKED';
            downloadDetail =
                'Waiting for a COMPLETE scan';
        }

        const missingCoverage =
            incompleteCoverage();

        const coverageText =
            !state.userId
                ? 'NOT SCANNED'
                : (
                    missingCoverage.length
                        ? 'INCOMPLETE'
                        : 'COVERAGE OK'
                );

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
                ? 'DISK VERIFIED'
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
                    <span>Existing <b>${existing}</b></span>
                    <span>Missing <b>${pending}</b></span>
                    <span>HIDDEN <b>${hiddenExisting}/${hiddenTotal}</b></span>
                    <span>Downloaded <b>${state.downloaded}</b></span>
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
                    <span>HIDDEN missing copies</span>
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
                'a[href*="/p/"],a[href*="/reel/"],a[href*="/tv/"]'
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

            const m =
                u.pathname.match(
                    /^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?/
                );

            if (!m) {
                return null;
            }

            const rawToken =
                String(m[2] || '');

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
                route: m[1],
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

                        const forced =
                            info.route === 'reel'
                                ? 'REEL'
                                : '';

                        addMedia(
                            item,
                            forced,
                            sourceHint
                        );

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

    function normalizedRestrictionPayload(raw) {
        return String(raw || '')
            .replace(/\\u0027/gi, "'")
            .replace(/\\u2019/gi, "’")
            .replace(/\\u0026/gi, '&')
            .replace(/&apos;|&#39;|&#x27;/gi, "'")
            .replace(/&quot;|&#34;|&#x22;/gi, '"')
            .replace(/\\[nrt]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function rawRestrictionEvidence(html) {
        const text = normalizedRestrictionPayload(html);

        if (!text) {
            return false;
        }

        const restrictedHeading =
            /\brestricted profile\b/i.test(text) ||
            /\bprofil restreint\b/i.test(text);

        const audienceGate =
            /unavailable for certain audiences/i.test(text) ||
            /indisponible pour certains publics/i.test(text);

        const loginGate =
            /log in to continue/i.test(text) ||
            /connectez-vous pour continuer/i.test(text);

        const ageGate =
            /you must be \d{1,2} years? old or over to see this profile/i.test(text) ||
            /you must be \d{1,2} or older to see this profile/i.test(text) ||
            /vous devez avoir \d{1,2} ans(?: ou plus)? pour (?:voir|consulter) ce profil/i.test(text);

        return !!(
            restrictedHeading &&
            audienceGate &&
            (loginGate || ageGate)
        );
    }

    function anonymousTimelineSSRPresent(html) {
        const doc = new DOMParser().parseFromString(
            String(html || ''),
            'text/html'
        );

        for (const script of doc.querySelectorAll('script[type="application/json"]')) {
            if (
                String(script.textContent || '')
                    .includes('polaris_ordered_timeline_connection')
            ) {
                return true;
            }
        }

        return false;
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

    async function probeAnonymousPublicControl() {
        const controls = ['instagram', 'natgeo']
            .filter(
                username =>
                    username.toLowerCase() !==
                    String(state.username || '').toLowerCase()
            );

        for (const username of controls) {
            let r;

            try {
                r = await fetchAnonymousProfileProbe(
                    username,
                    `PUBLIC shadow control @${username}`,
                    true
                );
            }
            catch (e) {
                throwIfInstagramStop(
                    e,
                    `PUBLIC shadow control @${username}`
                );

                continue;
            }

            if (Number(r.status || 0) !== 200) {
                continue;
            }

            const html = String(r.responseText || '');

            if (
                anonymousTimelineSSRPresent(html) &&
                !anonymousProfileRestriction(html)
            ) {
                return {
                    ok: true,
                    username,
                };
            }
        }

        return {
            ok: false,
            username: '',
        };
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

                const firstRawRestriction =
                    rawRestrictionEvidence(targetHtml);

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
                        `PUBLIC shadow N/A: @${state.username} returned an ` +
                        `explicit Instagram restricted-profile gate on verification. ` +
                        `Connected PROFILE/REELS/HIDDEN/HYDRATION coverage remains mandatory.`
                    );

                    status(
                        'PUBLIC shadow N/A for login-restricted profile.',
                        'ok'
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
                        retryError?.message !==
                        'SSR public timeline not found'
                    ) {
                        throw retryError;
                    }

                    const rawExplicitGate =
                        firstRawRestriction ||
                        rawRestrictionEvidence(targetHtml);

                    const control =
                        await probeAnonymousPublicControl();

                    log(
                        `PUBLIC shadow verification: ` +
                        `retry_ssr=false, ` +
                        `explicit_gate=${rawExplicitGate}, ` +
                        `public_control=${control.ok
                            ? `@${control.username}:SSR=true`
                            : 'SSR=false'}.`
                    );

                    if (
                        control.ok &&
                        state.profileInfo?.is_private === false &&
                        state.coverage.profileGrid === true
                    ) {
                        state.shadow.applicable = false;
                        state.shadow.reason = rawExplicitGate
                            ? 'LOGIN_RESTRICTED_PROFILE'
                            : 'ANONYMOUS_TARGET_UNAVAILABLE';
                        state.coverage.publicShadow = true;

                        log(
                            `PUBLIC shadow N/A: @${state.username} is available ` +
                            `to the connected session, but its anonymous timeline ` +
                            `remained unavailable on two target probes while ` +
                            `public control @${control.username} returned a valid SSR timeline. ` +
                            `This is treated as target-specific anonymous unavailability; ` +
                            `Connected PROFILE/REELS/HIDDEN/HYDRATION coverage remains mandatory.`
                        );

                        status(
                            rawExplicitGate
                                ? 'PUBLIC shadow N/A for login-restricted profile.'
                                : 'PUBLIC shadow N/A: anonymous target unavailable.',
                            'ok'
                        );

                        updateStats();
                        return true;
                    }

                    throw new Error(
                        'SSR public timeline not found after target/control verification'
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

        for (const alternate of alternates) {
            if (!findAnchor(alternate.path)) {
                continue;
            }

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

        return { attempted: true, captured: false, method: 'reentry-missed', roots: 0, pageInfo: null };
    }
    function profileNativeCompletionRequest(userKey) {
        const native = net.gridNativeContinuationByUser.get(userKey);
        const audit = net.gridNativeAuditByUser.get(userKey);
        // A successful first-page request does not establish the
        // shape of a forward-pagination query. The continuation
        // contract must have succeeded natively at least once.
        if (
            !audit ||
            audit.continuation < 1 ||
            !native ||
            !GRID_NAMES.has(native.friendly) ||
            !/^\d+$/.test(native.docId) ||
            !native.variables ||
            typeof native.variables !== 'object' ||
            !native.template ||
            !requestTargetsCurrentProfile({ variables:native.variables })
        ) return null;
        return native;
    }

    function profileCompletionVariables(nativeVariables, cursor = null) {
        const vars = JSON.parse(
            JSON.stringify(nativeVariables || {})
        );

        // First page: retain the exact observed request variables.
        // Only discard an inherited cursor from an earlier native
        // request, to start an independent completion traversal.
        if ('after' in vars) vars.after = null;
        if ('before' in vars) vars.before = null;
        if (vars.data && typeof vars.data === 'object') {
            if ('after' in vars.data) vars.data.after = null;
            if ('before' in vars.data) vars.data.before = null;
        }

        if (!cursor) return vars;

        // A *next-page* Relay query has a distinct connection
        // argument contract. An initial grid request can omit
        // first/before/last, while pagination requires them.
        const nested = !!(
            vars.data &&
            typeof vars.data === 'object' &&
            Object.prototype.hasOwnProperty.call(vars.data,'after') &&
            !Object.prototype.hasOwnProperty.call(vars,'after')
        );
        const root =
            Object.prototype.hasOwnProperty.call(vars,'after');
        if (!nested && !root) return null;
        const params = nested ? vars.data : vars;
        const pageSize = Number(
            params.first ||
            vars.first ||
            vars.data?.first ||
            vars.data?.count ||
            0
        );

        // Never guess a page size or invent continuation requests
        // if the original native query did not advertise one.
        if (
            !Number.isSafeInteger(pageSize) ||
            pageSize < 1 ||
            pageSize > 100
        ) return null;

        params.after = cursor;
        params.before = null;
        params.first = pageSize;
        params.last = null;
        return vars;
    }

    async function scanProfileGraphQLFallback(context = {}) {
        const startOwned = ownedCount();
        const reason = String(context.reason || 'completion');
        const userKey = state.username.toLowerCase();
        const native = profileNativeCompletionRequest(userKey);
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

        if (!native) {
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

        const docId = native.docId;
        log(
            'PROFILE native Relay completion starting: ' +
            'current=' + startOwned +
            ', reason=' + reason +
            ', doc=' + docId +
            ', native_doc=' + (observedDoc || '-') +
            ', native_doc_differs=' +
            (!!observedDoc && observedDoc !== docId) + '.',
            'warn'
        );

        let cursor = null;
        let gotResponse = false;
        let ended = false;
        let endReason = 'max_pages';
        let pages = 0;
        let totalEdges = 0;
        const seenCursors = new Set();

        for (let page = 1; page <= APP.PROFILE_MAX_SCROLLS; page++) {
            if (state.cancelled) throw new Error('Cancelled');

            const vars = profileCompletionVariables(
                native.variables, cursor
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
                    docId, vars, native.friendly, {
                        endpoint:native.endpoint,
                        nativeTemplate:native.template,
                        rootField:
                            native.template.headers?.['x-root-field-name'] ||
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

            const c = gridConn(data);
            if (!c) {
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

            for (const edge of edges) {
                addMedia(edgeNode(edge), '', 'PROFILE_FALLBACK');
            }

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
                ended = true;
                endReason = 'page_info_end';
                break;
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

                const fallback =
                    await scanProfileGraphQLFallback({
                        reason,
                        preferCanonicalDoc:
                            true,
                    });

                /*
                 * Once canonical completion is requested, ONLY its own
                 * pagination result may prove the end. Never OR it with a
                 * stale/partial native page_info=false.
                 */
                navigationEnded =
                    fallback.ended ===
                    true;
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

        const nav =
            await go(target);

        if (
            !nav.ok &&
            pathNorm(
                location.pathname
            ) !==
            pathNorm(target)
        ) {
            log(
                'Could not open REELS tab. Running GraphQL completion pass.',
                'warn'
            );

            return scanReelsFallback({
                reason: 'native_navigation_failed',
                nativeRoots: state.roots.REEL.size,
            });
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

            /*
             * v1.4.3 FIX:
             *
             * v1.4.2 only ran the GraphQL fallback when BOTH the network
             * capture and DOM were completely empty. A partial native scan
             * (for example 23 roots while more existed) therefore prevented
             * the fallback from ever running.
             *
             * The GraphQL pass is now ALWAYS used as a completion pass.
             * addMedia() and the REEL root Set already deduplicate overlaps,
             * so replaying the first pages is safe.
             */
            const completed =
                await scanReelsFallback({
                    reason: nativeEndReason,
                    nativeRoots,
                    nativeEnded,
                });

            /*
             * Anti-loss cross-check: every REEL visibly present in the native
             * DOM must also be represented in the final exhaustive REEL root
             * set. GraphQL reaching page_info_end is necessary, but it must
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
                    `remain unresolved after GraphQL completion.`,
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

    async function scanReelsFallback(context = {}) {
        const startRoots =
            state.roots.REEL.size;

        const nativeRoots =
            Number(
                context.nativeRoots ??
                startRoots
            );

        const reason =
            String(
                context.reason ||
                'completion'
            );

        log(
            `REEL GraphQL completion starting: ` +
            `native=${nativeRoots}, ` +
            `current=${startRoots}, ` +
            `reason=${reason}.`,
            'warn'
        );

        state.coverage.reels = false;

        let after = null;
        let gotResponse = false;
        let ended = false;
        let endReason = 'max_pages';
        let pages = 0;
        let totalEdges = 0;

        const seenCursors =
            new Set();

        for (
            let page = 1;
            page <= APP.REEL_MAX_SCROLLS;
            page++
        ) {
            if (
                state.cancelled
            ) {
                throw new Error(
                    'Cancelled'
                );
            }

            const vars = {
                data: {
                    include_feed_video: true,
                    page_size: 12,
                    target_user_id: state.userId,
                },
            };

            if (after) {
                vars.data.max_id = after;
            }

            let d;

            try {
                d = await gql(
                    APP.REEL_FALLBACK_DOC,
                    vars,
                    'PolarisProfileReelsTabContentQuery'
                );

                gotResponse = true;
            }
            catch (e) {
                throwIfInstagramStop(e, 'REEL GraphQL completion: Instagram returned feedback_required.');

                endReason =
                    `graphql_error:${e.message}`;

                log(
                    `REEL GraphQL completion failed on page ${page}: ` +
                    `${e.message}`,
                    'warn'
                );

                break;
            }

            const c = reelConn(d);

            if (!c) {
                endReason =
                    'connection_missing';

                log(
                    `REEL GraphQL completion page ${page}: ` +
                    `connection missing.`,
                    'warn'
                );

                break;
            }

            const edges =
                c?.edges || [];

            pages++;
            totalEdges += edges.length;

            const beforePage =
                state.roots.REEL.size;

            for (
                const e
                of edges
            ) {
                addMedia(
                    edgeNode(e),
                    'REEL',
                    'REEL_FALLBACK'
                );
            }

            const afterPage =
                state.roots.REEL.size;

            const added =
                afterPage -
                beforePage;

            updateStats();

            log(
                `REEL GraphQL page ${page}: ` +
                `edges=${edges.length}, ` +
                `new=${added}, ` +
                `total=${afterPage}, ` +
                `has_next=${c?.page_info?.has_next_page ?? 'unknown'}.`
            );

            if (
                c?.page_info?.has_next_page ===
                    false
            ) {
                ended = true;
                endReason =
                    'page_info_end';
                break;
            }

            const next =
                String(
                    c?.page_info?.end_cursor ||
                    ''
                );

            if (!edges.length) {
                endReason =
                    'empty_page_without_end';
                break;
            }

            if (!next) {
                endReason =
                    'missing_cursor';
                break;
            }

            if (
                seenCursors.has(next)
            ) {
                endReason =
                    'repeated_cursor';

                log(
                    `REEL GraphQL completion cursor repeated on page ${page}; stopping.`,
                    'warn'
                );

                break;
            }

            seenCursors.add(next);
            after = next;

            await sleep(
                rand(
                    APP.PAGE_MIN,
                    APP.PAGE_MAX
                )
            );
        }

        if (!gotResponse) {
            ended = false;
        }

        state.coverage.reels =
            gotResponse && ended;

        const finalRoots =
            state.roots.REEL.size;

        const recovered =
            Math.max(
                0,
                finalRoots -
                startRoots
            );

        updateStats();

        log(
            `REEL GraphQL completion complete: ` +
            `pages=${pages}, ` +
            `edges=${totalEdges}, ` +
            `recovered=${recovered}, ` +
            `REEL=${finalRoots}, ` +
            `end=${endReason}, ` +
            `ended=${state.coverage.reels}.`
        );

        return state.coverage.reels;
    }

    async function scanTaggedGraphQL() {
        state.coverage.tagged = false;

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
                addMedia(
                    edgeNode(e),
                    'TAGGED',
                    'TAGGED'
                );
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
                state.coverage.tagged = true;
                endReason = 'page_info_end';
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
            `end=${endReason}, ended=${state.coverage.tagged}.`
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
                    hiId(
                        reel?.id
                    ) ===
                    String(state.userId)
            ) ||
            (
                reels.length === 1
                    ? reels[0]
                    : null
            );

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

        for (
            const x
            of (
                Array.isArray(items)
                    ? items
                    : []
            )
        ) {
            addMedia(
                x,
                'STORY',
                'STORY_WEB_GRAPHQL'
            );
        }

        state.coverage.story =
            true;

        updateStats();

        log(
            `STORY Web GraphQL: ${Array.isArray(items) ? items.length : 0} current items, ` +
            `reels=${reels.length}, ended=true.`
        );

        return true;
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
            trayEnded;

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
                    candidate =>
                        hiId(
                            candidate?.id
                        ) === id
                ) ||
                (
                    reels.length === 1
                        ? reels[0]
                        : null
                );

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

            for (const x of items) {
                addMedia(
                    x,
                    'HIGHLIGHT',
                    `HIGHLIGHT:${title}`
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
                `HIGHLIGHT “${title}”: ${items.length} items via Web GraphQL.`
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
                hiddenDiscoverySources(m)
                    .sort()
                    .join(','),
            ].join('|'))
            .sort()
            .join('\n');
    }

    function completedScanIntegrity() {
        if (
            !state.scanComplete ||
            state.scanOutcome !== 'COMPLETE'
        ) {
            return {
                ok: false,
                reason: `last scan outcome=${state.scanOutcome || 'NONE'}`,
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
            `REELS=${state.coverage.reels}, ` +
            `OWNED_HYDRATION=${state.coverage.ownedHydration}, ` +
            `TAGGED=${state.coverage.tagged}, ` +
            `HIGHLIGHTS=${state.coverage.highlights}, ` +
            `STORY=${state.coverage.story}, ` +
            `AVATAR=${state.coverage.avatar}.`
        );
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
        state.scanUserId = '';
        state.scanQueueSize = 0;
        state.scanQueueFingerprint = '';

        state.queue.clear();
        state.rootCatalog.clear();

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
        state.hiddenCopiesDownloaded = 0;
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

            net.gridByUser.set(
                state.username.toLowerCase(),
                new Map()
            );
            net.gridPageInfo.delete(
                state.username.toLowerCase()
            );
            net.gridDocByUser.delete(
                state.username.toLowerCase()
            );
            net.gridQueryByUser.delete(
                state.username.toLowerCase()
            );
            net.gridNativeAuditByUser.delete(
                state.username.toLowerCase()
            );
            net.gridNativeContinuationByUser.delete(
                state.username.toLowerCase()
            );
            net.reelsByUserId.set(
                state.userId,
                new Map()
            );
            net.reelPageInfo.delete(
                state.userId
            );

            net.taggedDocInitial = '';
            net.taggedDocConnection = '';
            net.taggedNativeVariables = null;
            net.taggedInitialData = null;
            net.taggedInitialUserId = '';

            net.highlightTrayDoc = '';
            net.highlightTrayFriendly = '';
            net.highlightTrayVariables = null;
            net.highlightTrayEndpoint = '';
            net.highlightTrayData = null;
            net.highlightTrayUserId = '';

            updateStats();

            if (
                scanSelected('post') ||
                scanSelected('reel')
            ) {
                await scanProfilerPhase(
                    'PROFILE GRID',
                    scanMainGrid,
                    scanProfilerTimings
                );
            }

            if (scanSelected('post')) {
                await scanProfilerPhase(
                    'PUBLIC SHADOW',
                    scanPublicShadow,
                    scanProfilerTimings
                );
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
                state.scanOutcome = 'COMPLETE';
                state.scanUserId = String(state.userId || '');
                state.scanQueueSize = state.queue.size;
                state.scanQueueFingerprint = scanDownloadFingerprint();

                status(
                    `Accessible scan complete: ${state.queue.size} unique media.`,
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

                log('=== SCAN FINISHED — COMPLETE ===', 'ok');
            }
            else {
                state.scanComplete = false;
                state.scanOutcome = 'INCOMPLETE';

                status(
                    `Scan INCOMPLETE: ${incomplete.join(', ') || 'scan state invalid'}. Do not download yet.`,
                    'warn'
                );

                log(
                    `Accessible scan incomplete: ${incomplete.join(', ') || 'scan state invalid'}.`,
                    'warn'
                );

                log('=== SCAN FINISHED — INCOMPLETE ===', 'warn');
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
        state.diskHidden.clear();
        state.diskStoryHighlight.clear();
        state.legacy.clear();

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

                const hiddenPath =
                    /(?:^|\/)[^/]+\s-\sHIDDEN(?:\/|$)/i
                        .test(
                            relativePath
                        );

                if (hiddenPath) {
                    state.diskHidden
                        .add(m[1]);
                }
                else {
                    const id =
                        String(m[1]);

                    state.diskCanonical
                        .add(id);

                    state.diskCanonicalMeta
                        .set(
                            id,
                            {
                                type:
                                    canonicalType,
                                ext:
                                    String(
                                        m[2] ||
                                        ''
                                    )
                                        .toLowerCase(),
                                name:
                                    String(
                                        f.name ||
                                        ''
                                    ),
                            }
                        );
                }

                continue;
            }

            m =
                f.name.match(
                    legacy
                );

            if (!m) {
                continue;
            }

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

        state.diskActive = true;

        updateStats();

        status(
            `Local folder indexed ` +
            `(${files.length} files). ` +
            `Disk is authoritative.`,
            'ok'
        );

        log(
            `Local archive indexed: ` +
            `${files.length} files, ` +
            `${state.diskCanonical.size} canonical IDs, ` +
            `${state.diskHidden.size} HIDDEN copies, ` +
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

        if (
            state.diskActive
        ) {
            if (
                state.diskCanonical
                    .has(id)
            ) {
                return 'DISK';
            }

            if (
                legacyMatch(m)
            ) {
                return 'LEGACY';
            }

            /*
             * Disk is authoritative once explicitly indexed.
             */
            return null;
        }

        /*
         * Without an explicit local-folder index, only files written during
         * this page session are physically verified. The persisted ledger and
         * imported manifest are historical hints, not proof that a file still
         * exists on disk. downloadMissing() blocks on such unverified history
         * instead of silently skipping media.
         */
        if (
            state.diskCanonical
                .has(id)
        ) {
            return 'SESSION';
        }

        return null;
    }

    function hiddenCopyExistingReason(m) {
        if (
            !isHiddenMedia(m) ||
            state.settings.force
        ) {
            return null;
        }

        const id =
            String(
                m.id
            );

        if (state.diskHidden.has(id)) {
            return state.diskActive
                ? 'DISK_HIDDEN'
                : 'SESSION_HIDDEN';
        }

        return null;
    }

    function unverifiedArchiveHistory() {
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
            of state.queue.values()
        ) {
            const id =
                String(m.id);

            /*
             * A successful download in this page session is already verified.
             */
            if (
                state.diskCanonical
                    .has(id)
            ) {
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
                            () => resolve(),

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
                await downloadAttempt(
                    m,
                    {
                        safeHighlightFallback,
                    }
                );

                recordDownloaded(
                    m
                );

                state
                    .diskCanonical
                    .add(
                        String(m.id)
                    );

                if (state.diskActive) {
                    state.diskCanonicalMeta
                        .set(
                            String(m.id),
                            {
                                type:
                                    String(
                                        m.type ||
                                        ''
                                    )
                                        .toUpperCase(),
                                ext:
                                    String(
                                        m.ext ||
                                        ''
                                    )
                                        .toLowerCase(),
                                name:
                                    String(
                                        m.filename ||
                                        ''
                                    ),
                            }
                        );
                }

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

    async function downloadHiddenCopy(m) {
        if (
            !isHiddenMedia(m) ||
            hiddenCopyExistingReason(m)
        ) {
            return true;
        }

        const startedAt =
            performance.now();

        let last = null;

        for (
            let attempt = 1;
            attempt <= APP.DOWNLOAD_RETRIES;
            attempt++
        ) {
            if (state.cancelled) {
                return false;
            }

            try {
                await downloadAttempt(
                    m,
                    {
                        hiddenCopy: true,
                    }
                );

                state.diskHidden.add(
                    String(m.id)
                );

                state.hiddenCopiesDownloaded++;

                markDownloadOperation(
                    true,
                    m,
                    'HIDDEN'
                );

                recordHiddenDownloaded(
                    m
                );

                const elapsed =
                    (performance.now() -
                        startedAt) /
                    1000;

                log(
                    `✓ HIDDEN COPY ${m.filename} — ` +
                    `${elapsed.toFixed(2)} s ` +
                    `[${hiddenDiscoverySources(m).join(', ')}]`
                );

                updateStats();

                return true;
            }
            catch (e) {
                last = e;

                const illegalPath =
                    /filename must not contain illegal characters|illegal filename|invalid filename/i
                        .test(
                            String(
                                e?.message ||
                                ''
                            )
                        );

                if (illegalPath) {
                    log(
                        `HIDDEN download path rejected: "${e?.downloadPath || archiveDownloadPath(m, state.username, { hiddenCopy: true })}".`,
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
                        rand(
                            150,
                            650
                        );

                    log(
                        `↻ HIDDEN COPY ${m.filename} — retry ` +
                        `${attempt + 1}/${APP.DOWNLOAD_RETRIES} ` +
                        `after ${e.message}`,
                        'warn'
                    );

                    await sleep(
                        wait
                    );
                }
            }
        }

        state.failed++;

        markDownloadOperation(
            false,
            m,
            'HIDDEN'
        );

        const elapsed =
            (performance.now() -
                startedAt) /
            1000;

        log(
            `✗ HIDDEN COPY ${m.filename} — ` +
            `${last?.message || 'download failed after retries'} ` +
            `(${elapsed.toFixed(2)} s)`,
            'error'
        );

        updateStats();

        return false;
    }

    async function downloadOne(m) {
        const mainExisting =
            existingReason(m);

        const hiddenNeeded =
            isHiddenMedia(m) &&
            !hiddenCopyExistingReason(m);

        if (!mainExisting) {
            const mainOk =
                await downloadMainOne(
                    m
                );

            if (!mainOk) {
                if (
                    hiddenNeeded &&
                    !state.cancelled
                ) {
                    markDownloadOperation(
                        false,
                        m,
                        'HIDDEN',
                        { blocked: true }
                    );

                    updateStats();
                }

                return false;
            }
        }

        if (hiddenNeeded) {
            return downloadHiddenCopy(
                m
            );
        }

        return true;
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

    async function downloadMissing() {
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

        const scanIntegrity = completedScanIntegrity();

        if (!scanIntegrity.ok) {
            status(
                `Download blocked: no immutable COMPLETE scan (${scanIntegrity.reason}).`,
                'warn'
            );

            log(
                `Archive guard blocked download: ${scanIntegrity.reason}. ` +
                `Run a new SCAN and require === SCAN FINISHED — COMPLETE === first.`,
                'warn'
            );

            return;
        }

        const incomplete = incompleteCoverage();

        if (incomplete.length) {
            status(
                `Download blocked: incomplete ${incomplete.join(', ')}.`,
                'warn'
            );

            return;
        }

        const unverified =
            unverifiedArchiveHistory();

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
                [...state.queue.values()]
                    .filter(
                        m =>
                            !existingReason(m) ||
                            (
                                isHiddenMedia(m) &&
                                !hiddenCopyExistingReason(m)
                            )
                    );

            const downloadPlan =
                beginDownloadProgress(
                    pending
                );

            if (
                !pending.length
            ) {
                const verified = state.diskActive
                    ? state.diskCanonical.size
                    : state.queue.size;

                const message =
                    `Archive already complete for this scan — ` +
                    `${state.queue.size}/${state.queue.size} scan media verified` +
                    `${state.diskActive ? ` on disk (${verified} indexed).` : '.'}`;

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
                `Starting download: ${pending.length} media jobs, ` +
                `${downloadPlan.total} physical writes ` +
                `(main=${downloadPlan.main}, hidden=${downloadPlan.hidden}), ` +
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

            log(
                `Download complete: ${completed} files in ` +
                `${batchElapsed.toFixed(2)} s — average ` +
                `${average.toFixed(2)} s/file.`
            );

            status(
                `Download complete: ` +
                `${state.downloaded} archive files, ` +
                `${state.hiddenCopiesDownloaded} HIDDEN copies, ` +
                `${state.failed} errors — ` +
                `${average.toFixed(2)} s/media-job average.`,
                state.failed
                    ? 'warn'
                    : 'ok'
            );
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
                publicShadow: { ...state.shadow },
                connectedHidden: {
                    ...state.hidden,
                    recoveredCodes: [...state.hidden.recoveredCodes],
                },
                hiddenArchive: {
                    media: hiddenMediaCount(),
                    copiesVerified: state.diskHidden.size,
                    copiesDownloadedThisSession:
                        state.hiddenCopiesDownloaded,
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
                username: '',
                mediaId:
                    media.mediaId,
                shortcode:
                    media.shortcode,
                key:
                    `media:${media.mediaId}`,
            };
        }
    
        return storyPermalinkInfo(
            value
        );
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
                'a[href*="/p/"],a[href*="/reel/"],a[href*="/tv/"]'
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
            target.kind === 'story'
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
            /^\d+$/.test(mediaId) &&
            (
                kind === 'story' ||
                kind === 'media'
            )
        ) {
            return {
                kind,
                route:
                    route ||
                    (
                        kind === 'story'
                            ? 'story'
                            : 'p'
                    ),
                mediaId,
                shortcode,
                username,
                key:
                    `${kind}:${mediaId}`,
            };
        }
    
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
        forcedType = ''
    ) {
        const root =
            raw?.media &&
            typeof raw.media === 'object'
                ? raw.media
                : raw;

        if (!root) {
            return [];
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

        const units =
            children.length
                ? children
                : [root];

        const out = [];

        for (const child of units) {
            const id =
                normalizePk(child) ||
                normalizePk(root);

            if (!id) {
                continue;
            }

            const video =
                isVideo(child);

            const url =
                video
                    ? bestVideo(child)
                    : bestImage(child);

            if (!url) {
                continue;
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
            !/^\d+$/.test(id) ||
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
            resolved.kind === 'story'
                ? `story ${id}`
                : (
                    resolved.shortcode ||
                    id
                );
    
        log(
            `Single download requested: kind=${resolved.kind}, route=${resolved.route || '-'}, ` +
            `shortcode=${resolved.shortcode || '-'}, id=${id}.`
        );
    
        singleDownloadState.busy.add(
            key
        );
    
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
                await fetchStandaloneMediaInfo(
                    id,
                    `SINGLE ${String(resolved.kind || 'media').toUpperCase()} ${label}`
                );
    
            const forcedType =
                resolved.kind === 'story'
                    ? 'STORY'
                    : resolved.route === 'reel'
                        ? 'REEL'
                        : '';
    
            const files =
                standaloneUnits(
                    item,
                    forcedType
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
        if (
            !anchor ||
            anchor.dataset.jklSingleDownload === '1'
        ) {
            return;
        }
    
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
            return;
        }
    
        if (
            !anchor.querySelector(
                'img,video'
            )
        ) {
            return;
        }
    
        const host =
            anchor.parentElement;
    
        if (!host) {
            return;
        }
    
        anchor.dataset.jklSingleDownload =
            '1';
    
        host.dataset.jklSingleHost =
            '1';
    
        if (
            getComputedStyle(host).position ===
            'static'
        ) {
            host.style.position =
                'relative';
        }
    
        const button =
            document.createElement(
                'button'
            );
    
        button.type =
            'button';
    
        button.className =
            'jkl-single-download';
    
        applySingleDownloadTarget(
            button,
            target
        );
    
        button.innerHTML =
            singleDownloadIconHtml();
    
        host.appendChild(
            button
        );
    }
    function currentMediaRoot() {
        const dialog =
            document.querySelector(
                'div[role="dialog"]'
            );

        if (
            dialog?.querySelector(
                'img,video'
            )
        ) {
            return dialog;
        }

        if (storyPermalinkInfo(location.href)) {
            return document.querySelector('main') ||
                document.body;
        }

        const articles =
            [
                ...document.querySelectorAll(
                    'article'
                ),
            ];

        const visible =
            articles
                .filter(
                    article =>
                        article.querySelector(
                            'img,video'
                        ) &&
                        article.getClientRects()
                            .length
                )
                .sort(
                    (a, b) => {
                        const ar =
                            a.getBoundingClientRect();

                        const br =
                            b.getBoundingClientRect();

                        const aa =
                            Math.max(
                                0,
                                ar.width
                            ) *
                            Math.max(
                                0,
                                ar.height
                            );

                        const ba =
                            Math.max(
                                0,
                                br.width
                            ) *
                            Math.max(
                                0,
                                br.height
                            );

                        return ba - aa;
                    }
                );

        return (
            visible[0] ||
            document.querySelector(
                'main'
            ) ||
            document.body
        );
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

    function currentMediaOverlayHost(media, root) {
        if (!media || !root) return null;
        const rect = media.getBoundingClientRect();

        for (
            let host=media.parentElement, depth=0;
            host && depth<7;
            host=host.parentElement, depth++
        ) {
            if (
                host === document.body ||
                host === document.documentElement
            ) break;

            // Do not nest an interactive button inside a link.
            if (!host.matches?.('a,button')) {
                const box=host.getBoundingClientRect();
                if (
                    box.width >= rect.width-8 &&
                    box.height >= rect.height-8 &&
                    box.width <= rect.width +
                        Math.max(44,rect.width*0.16) &&
                    box.height <= rect.height +
                        Math.max(44,rect.height*0.16)
                ) return host;
            }
            if (host === root) break;
        }
        return null;
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

    function placeCurrentDownloadButton(button, root) {
        const host = currentMediaOverlayHost(
            largestCurrentMedia(root),
            root
        );
        if (!host) {
            button.remove();
            return 'unavailable';
        }
        if (
            getComputedStyle(host).position ===
            'static'
        ) host.style.position = 'relative';

        button.classList.add(
            'jkl-media-download-overlay'
        );
        if (button.parentElement !== host) {
            host.appendChild(button);
        }
        return 'media-overlay';
    }

    function refreshCurrentDownloadButton() {
        const target = currentSingleDownloadTarget();
        const existing = document.getElementById(
            'jkl-current-download'
        );
        if (!target) {
            existing?.remove();
            return;
        }

        const root = currentMediaRoot();
        if (
            !currentMediaOverlayHost(
                largestCurrentMedia(root),
                root
            )
        ) {
            existing?.remove();
            return;
        }

        const button=ensureCurrentDownloadButton();
        applySingleDownloadTarget(button,target);
        button.dataset.placement =
            placeCurrentDownloadButton(button,root);
    }

    function refreshSingleDownloadUi() {
        for (
            const anchor
            of document.querySelectorAll(
                'a[href*="/p/"],a[href*="/reel/"],a[href*="/tv/"]'
            )
        ) {
            addSingleDownloadButtonToAnchor(
                anchor
            );
        }

        refreshCurrentDownloadButton();
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
                opacity:.18;
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
                position:absolute;
                z-index:31;
                top:10px;
                right:10px;
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

            download:
                b.querySelector(
                    '#jkl-download'
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

        ui.download.onclick =
            downloadMissing;

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