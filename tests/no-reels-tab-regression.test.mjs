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
        verifiedPassiveReelRootIds: new Set(),
    };
    const net = {
        reelsByUserId: new Map(),
        reelNativeAuditByUserId: new Map(),
    };
    const location = { pathname:'/jennnii97/' };
    const runner = new Function(
        'state', 'net', 'location', 'window', 'log', 'status',
        'pathNorm', 'findAnchor', 'go', 'scanReelsNativeCompletion', 'updateStats',
        extract('scanReels') + '\nreturn scanReels;'
    )(
        state, net, location, { scrollY: 0 },
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
assert.equal(noTab.counts.nativeCompletion, 0, 'no unsupported native completion request');
assert.equal(noTab.state.coverage.reels, false,
    'absence of a tab is not proof of zero reels');
assert.ok(noTab.logs.some(x => x.msg.includes('No new REELS request')),
    'feedback_required endpoint must not be called when native tab is absent');

const failedClick = scenario({ hasLink: true, navOK: false });
assert.equal(await failedClick.runner(), false);
assert.equal(failedClick.counts.navigation, 1);
assert.equal(failedClick.counts.nativeCompletion, 0,
    'failed navigation without native pagination evidence cannot complete');
assert.ok(failedClick.logs.some(x => x.msg.includes('obsolete static GraphQL fallback')));

// PROFILE grid can be complete from the independent public server end.
// Global backup remains incomplete because REELS has its own guard.
// Missing navigation must never synthesize a valid empty REELS page.
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
assert.equal(proof.verified, true);
assert.equal(proof.reason, 'public_connected_cross_surface_proof');
assert.equal(p.reelsComplete, false,
    'proof of the main grid does NOT prove that the reels feed is empty');
const requiredCoverage = new Function('scanSelection',
    extract('requiredCoverage') + '\nreturn requiredCoverage;'
)(() => ({ post: true, reel: true }));
const remaining = requiredCoverage().filter(([, key]) => key === 'reels');
assert.deepEqual(remaining, [['REELS tab', 'reels']],
    'REELS must remain separately required for full archive completion');


// A missing navigation tab is an operational SKIP for the exposed archive,
// not fabricated proof that the user's complete Reels feed contains zero.
{
    const state={
        userId:'45790055326',
        profileInfo:{pk:'45790055326'},
        coverage:{profileGrid:true,publicShadow:true,connectedHidden:true,
            ownedHydration:true,reels:false,tagged:true},
        reelsDiagnosis:{kind:'NOT_EXPOSED'},
        roots:{REEL:new Set()},
        shadow:{reelIds:new Set()},
    };
    const api=new Function('state','scanSelected','scanSelection',
        extract('reelsSurfaceSkipped')+
        extract('requiredCoverage')+
        extract('incompleteCoverage')+
        '\nreturn {reelsSurfaceSkipped,incompleteCoverage};'
    )(state,k=>['post','reel','tagged'].includes(k),
        ()=>({post:true,reel:true,tagged:true}));
    assert.equal(api.reelsSurfaceSkipped(),true);
    assert.ok(!api.incompleteCoverage().includes('REELS tab'),
        'missing native tab must not block already-verified exposed surfaces');
    assert.deepEqual(api.incompleteCoverage(),[]);

    state.coverage.tagged=false;
    assert.deepEqual(api.incompleteCoverage(),['TAGGED'],
        'an actual TAGGED failure remains blocking even when Reels skipped');
    state.coverage.tagged=true;
    for(const [label,mutate,restore] of [
        ['wrong profile identity',()=>{
            state.profileInfo.pk='987654321';
        },()=>{
            state.profileInfo.pk='45790055326';
        }],
        ['observed reel',()=>state.roots.REEL.add('42'),
            ()=>state.roots.REEL.clear()],
        ['positive clips metadata / tab',()=>{state.reelsDiagnosis.kind='UNVERIFIED';},
            ()=>{state.reelsDiagnosis.kind='NOT_EXPOSED';}],
        ['unknown public profile',()=>{state.coverage.profileGrid=false;},
            ()=>{state.coverage.profileGrid=true;}],
        ['unresolved hidden evidence',()=>{state.coverage.connectedHidden=false;},
            ()=>{state.coverage.connectedHidden=true;}],
        ['hydration incomplete',()=>{state.coverage.ownedHydration=false;},
            ()=>{state.coverage.ownedHydration=true;}],
    ]) {
        mutate();
        assert.equal(api.reelsSurfaceSkipped(),false,label);
        assert.ok(api.incompleteCoverage().includes('REELS tab'),label);
        restore();
    }
}
assert.ok(source.includes("'PolarisProfileReelsTabContentQuery'"));
assert.ok(!source.includes('async function scanReelsFallback('));
assert.ok(source.includes('=== SCAN STOPPED — INSTAGRAM API UNHEALTHY ==='));
assert.ok(!source.includes('https://www.instagram.com/api/v1/clips/user/'),
    'desktop userscript must not issue private-mobile clips requests');
assert.ok(!source.includes('scanReelsAuthenticatedWithoutTab'),
    'blocked fallback helper must not accidentally be reachable');
console.log('No-tab operational skip, positive-evidence guard, no mobile POST and independent PROFILE coverage tests passed.');
