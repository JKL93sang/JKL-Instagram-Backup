import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const m = new RegExp('    (?:async )?function ' + name + '\\(').exec(src);
    assert.ok(m, name + ' missing');
    const end = src.indexOf('\n    }\n', m.index);
    assert.ok(end > m.index, 'end missing: ' + name);
    return src.slice(m.index, end + 7);
}
const methods = [
    'verifiedPublicGridPrimaryProof',
    'assessProfileGridCrossSurfaceProof',
    'reconcileProfileGridCoverage',
    'explicitEmptyReelsProof',
    'classifyReelsEvidence',
    'reconcileEmptyReelsCoverage',
    'reelsSurfaceSkipped', 'requiredCoverage', 'incompleteCoverage',
    'scanAll',
].map(extract).join('\n');

function scenario({
    clips = 0, privateProfile = false, publicEnd = true,
    publicCount = 1, hasClips = false, identityMatches = true,
    noTab = true, hiddenCandidates = 0,
    ssrHasAnyClips = null, ssrClipsCount = null,
    ssrConsistent = true, latestReelMedia = undefined,
} = {}) {
    const userId = '45790055326';
    const postId = '800123';
    const plan = { post: true, reel: true, highlight: false,
        tagged: false, story: false, avatar: false };
    const state = {
        username: '', userId: '', expected: 0,
        running: false, downloading: false, cancelled: false,
        feedbackRequired: false, rateLimited: false, apiUnhealthy: false,
        scanComplete: false, scanOutcome: 'idle', scanPlan: null,
        queue: new Map(), rootCatalog: new Map(),
        roots: { POST: new Set(), REEL: new Set(), HIGHLIGHT: new Set(),
            STORY: new Set(), TAGGED: new Set(), AVATAR: new Set() },
        coverage: {}, shadow: {},
        hidden: {}, hydration: {},
        exclusive: {},
    };
    const net = {
        reelsByUserId: new Map(), reelPageInfo: new Map(),
        reelNativeAuditByUserId: new Map(),
        reelNativeInitialByUserId: new Map(),
        reelNativeContinuationByUserId: new Map(),
        gridByUser: new Map(), gridPageInfo: new Map(),
        gridNativeAuditByUser: new Map(),
    };
    const phases = [], logs = [], statuses = [];
    let nativeCalls = 0, partialGrants = 0, disabled = false;

    const scanSelected = kind => plan[kind] === true;
    const api = new Function(
        'state', 'net', 'ui', 'log', 'status', 'disable',
        'scanSelected', 'scanSelection', 'currentScanSelection',
        'currentProfile', 'cleanUser', 'resetScanProgress',
        'resetDownloadProgress', 'resetCoverage',
        'updateStats', 'performance', 'scanProfilerPhase',
        'resolveProfile', 'refreshProfileInfo', 'prepareProfileNativeEvidenceForScan',
        'prepareReelsNativeEvidenceForScan',
        'prepareTaggedNativeEvidenceForScan',
        'scanPublicShadow', 'scanMainGrid', 'scanConnectedHiddenCandidates',
        'scanReels', 'scanTagged', 'scanHighlights', 'scanStory',
        'scanAvatar', 'hydrateOwnedRootsDeep', 'logScanProfilerSummary',
        'ownedCount', 'globalGap', 'scanDownloadFingerprint',
        'capturePartialDownloadGrants', 'pathNorm', 'findAnchor', 'location',
        methods + '\nreturn { scanAll };'
    )(
        state, net, { username: { value:'jennnii97' } },
        (msg, severity) => logs.push({ msg, severity }),
        (msg, severity) => statuses.push({ msg, severity }),
        value => { disabled = value; },
        scanSelected, () => plan, () => plan,
        () => 'jennnii97', x => String(x || '').replace(/^@/, ''),
        () => {}, () => {},
        () => {
            state.coverage = {
                profileGrid: false, publicShadow: false,
                reels: false, connectedHidden: false, ownedHydration: false,
            };
            state.shadow = {
                applicable: false, profileId: '', pageInfoEnded: false,
                rootIds: new Set(), postIds: new Set(),
                reelIds: new Set(),
                reelsEvidence: null,
            };
            state.hidden = {
                candidates: 0, recovered: 0, previewOnly: 0, failed: 0,
            };
            state.hydration = {
                totalRoots: 0, hydratedRoots: 0,
            };
        },
        () => {}, { now: () => 10000 },
        async (label, work) => {
            phases.push(label);
            return await work();
        },
        async user => {
            state.username = user;
            state.userId = userId;
        },
        async () => {
            state.profileInfo = {
                pk: identityMatches ? userId : '999',
                media_count: 1,
                is_private: privateProfile,
                total_clips_count: clips,
                has_clips: hasClips,
                ...(latestReelMedia !== undefined ? { latest_reel_media:latestReelMedia } : {}),
            };
            state.expected = 1;
            state.exclusive.known = true;
            state.exclusive.hasExclusiveFeedContent = false;
            return true;
        },
        () => ({ retained:false }),
        () => ({ retained:false }),
        () => ({ retained:false }),
        async () => {
            state.shadow.applicable = !privateProfile;
            state.coverage.publicShadow = privateProfile || publicEnd;
            state.shadow.pageInfoEnded = !privateProfile && publicEnd;
            state.shadow.profileId = !privateProfile ? state.userId : '';
            state.shadow.reelsEvidence =
                !privateProfile && (ssrHasAnyClips !== null || ssrClipsCount !== null)
                    ? Object.freeze({
                        profileId:state.userId,
                        username:state.username.toLowerCase(),
                        hasAnyClips:ssrHasAnyClips,
                        totalClipsCount:ssrClipsCount,
                        latestReelPresent:false,
                        consistent:ssrConsistent,
                        source:'xig_user_by_username/public-profile-SSR',
                    }) : null;
            if (!privateProfile) {
                for (let i = 0; i < publicCount; i++) {
                    const id = String(Number(postId) + i);
                    state.shadow.rootIds.add(id);
                    state.shadow.postIds.add(id);
                    state.roots.POST.add(id);
                    state.queue.set(id, { id, type:'POST', filename:id+'.jpg' });
                }
            }
        },
        async () => {
            nativeCalls++;
            state.coverage.profileGrid = false;
        },
        async () => {
            state.hidden.candidates = hiddenCandidates;
            state.coverage.connectedHidden = true;
        },
        async () => { state.coverage.reels = false; },
        async () => {}, async () => {}, async () => {}, async () => {},
        async () => {
            state.coverage.ownedHydration = true;
            state.hydration.totalRoots = state.roots.POST.size;
            state.hydration.hydratedRoots = state.roots.POST.size;
        },
        () => {},
        () => new Set([...state.roots.POST, ...state.roots.REEL]).size,
        () => Math.max(0, state.expected - state.roots.POST.size),
        () => [...state.queue.keys()].sort().join(),
        () => { partialGrants++; },
        p => p.replace(/\/+$/, ''),
        () => !noTab,
        { pathname:'/jennnii97/' },
    );
    return {
        state, logs, statuses, phases, run: api.scanAll,
        get nativeCalls() { return nativeCalls; },
        get partialGrants() { return partialGrants; },
        get disabled() { return disabled; },
    };
}
{
    const x = scenario();
    await x.run();
    assert.equal(x.state.scanOutcome, 'COMPLETE',
        'one public POST with explicit zero clips and no REELS tab completes');
    assert.equal(x.state.coverage.profileGrid, true);
    assert.equal(x.state.coverage.reels, true);
    assert.equal(x.nativeCalls, 0, 'zero unnecessary native PROFILE capture requests');
    assert.equal(x.partialGrants, 0, 'no partial grants when scan is complete');
    assert.equal(x.disabled, false, 'UI unlocks after scan');
    assert.ok(x.phases.indexOf('PUBLIC SHADOW') < x.phases.indexOf('PROFILE GRID'));
    assert.ok(x.logs.some(l => l.msg.includes('PROFILE native phase not needed')));
    assert.ok(x.logs.some(l => l.msg.includes('REELS independently proven EMPTY')));
    assert.ok(x.logs.some(l => l.msg.includes('=== SCAN FINISHED — COMPLETE ===')));
}
{
    const x = scenario({clips:null});
    await x.run();
    assert.equal(x.state.scanOutcome, 'EXPOSED_COMPLETE',
        'no tab and no observed clips: process all accessible media');
    assert.equal(x.state.coverage.profileGrid, true);
    assert.equal(x.state.coverage.reels, false,
        'the skipped tab is not relabeled as a proven-empty Reel feed');
    assert.equal(x.state.reelsDiagnosis.kind, 'NOT_EXPOSED');
    assert.equal(x.nativeCalls, 0, 'good PROFILE proof survives missing Reel metadata');
    assert.equal(x.partialGrants, 0, 'normal batch is available, no partial grant needed');
    assert.ok(x.logs.some(l=>l.msg.includes('REELS SKIPPED')));
}
{
    const x = scenario({clips:null,latestReelMedia:0});
    await x.run();
    assert.equal(x.state.scanOutcome, 'EXPOSED_COMPLETE',
        'missing tab is skipped for the exposed archive, not proof of zero clips');
    assert.equal(x.state.coverage.reels, false);
    assert.ok(x.logs.some(l => l.msg.includes('REELS evidence=NOT_EXPOSED')));
    assert.equal(x.state.reelsDiagnosis.kind, 'NOT_EXPOSED');
}
{
    const x = scenario({clips:null,ssrClipsCount:null,noTab:true});
    await x.run();
    assert.equal(x.state.scanOutcome,'EXPOSED_COMPLETE',
        'no-tab target in the real user log finishes exposed surfaces');
    assert.equal(x.state.scanComplete,true);
    assert.equal(x.state.coverage.reels,false);
    assert.ok(x.statuses.some(v=>v.msg.includes('REELS tab absent')));
    assert.ok(!x.logs.some(v=>v.msg.includes('SCAN FINISHED — INCOMPLETE')));
}
{
    const x = scenario({clips:null,latestReelMedia:0,ssrHasAnyClips:false});
    await x.run();
    assert.equal(x.state.scanOutcome, 'COMPLETE',
        'REST placeholder cannot contradict explicit SSR absence');
}
{
    const x = scenario({clips:null,latestReelMedia:{pk:'123'},ssrHasAnyClips:false});
    await x.run();
    assert.equal(x.state.scanOutcome, 'COMPLETE',
        'latest_reel_media describes Stories and does not contradict SSR zero clips');
}
{
    const x = scenario({clips:null,ssrHasAnyClips:false});
    await x.run();
    assert.equal(x.state.scanOutcome, 'COMPLETE',
        'target SSR has_any_clips=false proves empty reels despite absent API clips count');
    assert.equal(x.state.coverage.profileGrid, true);
    assert.equal(x.state.coverage.reels, true);
    assert.equal(x.nativeCalls, 0);
    assert.ok(x.logs.some(l => l.msg.includes('source=public_ssr_has_any_clips_false')));
}
{
    const x = scenario({clips:null,ssrClipsCount:0});
    await x.run();
    assert.equal(x.state.scanOutcome, 'COMPLETE');
    assert.ok(x.logs.some(l => l.msg.includes('source=public_ssr_total_clips_count')));
}
{
    const x = scenario({clips:null,ssrHasAnyClips:true});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE',
        'SSR says clips exist, no tab cannot be assumed empty');
    assert.equal(x.state.coverage.reels, false);
}
{
    const x = scenario({clips:1,ssrHasAnyClips:false});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE',
        'authenticated positive count overrules SSR zero flag');
}
{
    const x = scenario({clips:null,ssrHasAnyClips:false,ssrConsistent:false});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE',
        'conflicting SSR data cannot prove zero');
}
{
    const x = scenario({clips:null,ssrHasAnyClips:false,noTab:false});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE',
        'verified SSR absence never bypasses an available REELS tab');
}
{
    const x = scenario({clips:1});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE');
    assert.equal(x.state.coverage.profileGrid, true);
    assert.equal(x.state.coverage.reels, false);
}
{
    const x = scenario({hasClips:true});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE');
    assert.equal(x.state.coverage.reels, false);
}
{
    const x = scenario({noTab:false});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE');
    assert.equal(x.state.coverage.reels, false);
}
for(const [label, opts] of [
    ['public pagination not ended',{publicEnd:false}],
    ['public missing root',{publicCount:0}],
    ['public counter mismatch',{publicCount:2}],
    ['private profile',{privateProfile:true}],
]) {
    const x = scenario(opts);
    await x.run();
    assert.ok(x.nativeCalls > 0, label + ': native fallback must run');
    assert.equal(x.state.scanOutcome, 'INCOMPLETE', label + ': no false COMPLETE');
}
{
    const x = scenario({identityMatches:false});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE',
        'cross-account profile metadata cannot prove empty REELS');
    assert.equal(x.state.coverage.profileGrid, true);
    assert.equal(x.state.coverage.reels, false);
}
{
    const x = scenario({hiddenCandidates:1});
    await x.run();
    assert.equal(x.state.scanOutcome, 'INCOMPLETE',
        'hidden candidates require separate resolution');
    assert.equal(x.state.coverage.profileGrid, false);
    assert.equal(x.state.coverage.reels, false);
}
console.log(
    'End-to-end scanAll source ordering, complete 1 POST/0 REEL, missing count, ' +
    'private/partial fallbacks, identity and hidden fail-closed tests passed.'
);
