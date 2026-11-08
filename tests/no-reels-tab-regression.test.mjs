import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);

function extract(name) {
    let index = source.indexOf('    async function ' + name + '(');
    if (index < 0) index = source.indexOf('    function ' + name + '(');
    assert.ok(index >= 0, 'missing function ' + name);
    const end = source.indexOf('\n    }\n', index);
    assert.ok(end > index, 'missing function boundary ' + name);
    return source.slice(index, end + 7);
}

function scenario({ hasLink = false, navOK = false } = {}) {
    const logs = [];
    const counts = { navigation: 0, nativeCompletion: 0, updates: 0 };
    const state = {
        username: 'jennnii97',
        userId: '45790055326',
        coverage: { reels: true },
        roots: { REEL: new Set() },
    };
    const location = { pathname:'/jennnii97/' };
    const runner = new Function(
        'state', 'location', 'window', 'log', 'status',
        'pathNorm', 'findAnchor', 'go', 'scanReelsNativeCompletion', 'updateStats',
        extract('scanReels') + '\nreturn scanReels;'
    )(
        state, location, { scrollY: 0 },
        (msg, level) => logs.push({ msg, level }),
        () => {},
        x => String(x).endsWith('/') ? String(x).slice(0, -1) : String(x),
        path => hasLink ? { href: path } : null,
        async () => {
            counts.navigation++;
            return { ok: navOK, navigated: navOK };
        },
        async () => {
            counts.nativeCompletion++;
            return false;
        },
        () => counts.updates++
    );
    return { runner, state, counts, logs };
}

const noTab = scenario({ hasLink: false });
assert.equal(await noTab.runner(), false);
assert.equal(noTab.counts.navigation, 0, 'no navigation attempt without link');
assert.equal(noTab.counts.nativeCompletion, 0, 'no unsupported completion request');
assert.equal(noTab.state.coverage.reels, false,
    'absence of a tab is not proof of zero reels');
assert.ok(noTab.logs.some(x => x.msg.includes('REELS stays INCOMPLETE')));

const failedClick = scenario({ hasLink: true, navOK: false });
assert.equal(await failedClick.runner(), false);
assert.equal(failedClick.counts.navigation, 1);
assert.equal(failedClick.counts.nativeCompletion, 0,
    'failed navigation without native pagination evidence cannot complete');
assert.ok(failedClick.logs.some(x => x.msg.includes('obsolete static GraphQL fallback')));

// The real global completeness proof still needs independently completed REELS
// coverage. Missing navigation must never synthesize a valid empty page.
const assess = new Function(
    extract('assessProfileGridCrossSurfaceProof') +
    '\nreturn assessProfileGridCrossSurfaceProof;'
)();
const p = {
    selectedPost:true,selectedReel:true,
    publicProfile:true,exclusiveKnown:true,hasExclusive:false,
    shadowApplicable:true,profileId:'45790055326',shadowProfileId:'45790055326',
    shadowComplete:true,shadowPageInfoEnd:true,
    counterVerified:true,expected:1,
    publicRootIds:new Set(['111']),publicPostIds:new Set(['111']),
    publicReelIds:new Set(),
    reelsComplete:false,connectedHiddenComplete:true,ownedHydrationComplete:true,
    hiddenCandidates:0,hiddenRecovered:0,hiddenPreviewOnly:0,hiddenFailed:0,
    ownedPostIds:new Set(['111']),ownedReelIds:new Set(),
};
const proof = assess(p);
assert.equal(proof.verified, false);
assert.equal(proof.reason, 'connected_surfaces_not_equivalent');

assert.ok(source.includes("'PolarisProfileReelsTabContentQuery'"));\nassert.ok(!source.includes('async function scanReelsFallback('));
assert.ok(source.includes('=== SCAN STOPPED — INSTAGRAM API UNHEALTHY ==='));
console.log('No-REELS-tab safe skip and completeness guard regression tests passed.');
