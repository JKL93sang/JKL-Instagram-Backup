import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js',import.meta.url),
    'utf8'
);
function extract(name){
    let i=src.indexOf('    function '+name+'(');
    if(i<0)i=src.indexOf('    async function '+name+'(');
    assert.ok(i>=0,'function not found: '+name);
    let j=src.indexOf('\n    }\n',i);
    assert.ok(j>i,'function end not found: '+name);
    return src.slice(i,j+7);
}
const assess=new Function(
    extract('assessProfileGridCrossSurfaceProof') +
    '\nreturn assessProfileGridCrossSurfaceProof;'
)();
const base=()=>{
    const post=new Set(Array.from({length:21},(_,i)=>String(100+i)));
    const reel=new Set(['200']);
    return {
        selectedPost:true,selectedReel:true,
        publicProfile:true,exclusiveKnown:true,hasExclusive:false,
        shadowApplicable:true,
        profileId:'1234567',shadowProfileId:'1234567',
        shadowComplete:true,shadowPageInfoEnd:true,
        expected:22,
        publicRootIds:new Set([...post,...reel]),
        publicPostIds:post,publicReelIds:reel,
        reelsComplete:true,connectedHiddenComplete:true,
        ownedHydrationComplete:true,
        hiddenCandidates:0,hiddenRecovered:0,
        hiddenPreviewOnly:0,hiddenFailed:0,
        ownedPostIds:new Set(post),
        ownedReelIds:new Set(['200','201','202']),
    };
};
const yes=base();
assert.deepEqual(assess(yes),{
    verified:true,reason:'public_connected_cross_surface_proof',missing:0
},'An exhaustive 22-root public grid and independent Reel/hidden/hydration proofs should reconcile');

const reject=(mutate,reason)=>{
    const p=base();mutate(p);
    const r=assess(p);
    assert.equal(r.verified,false,reason);
    assert.equal(r.reason,reason);
};
reject(p=>{p.selectedPost=false},'post_and_reel_scans_required');
reject(p=>{p.selectedReel=false},'post_and_reel_scans_required');
reject(p=>{p.publicProfile=false},'public_access_equivalence_unavailable');
reject(p=>{p.hasExclusive=true},'public_access_equivalence_unavailable');
reject(p=>{p.exclusiveKnown=false},'public_access_equivalence_unavailable');
reject(p=>{p.shadowApplicable=false},'public_access_equivalence_unavailable');
reject(p=>{p.shadowProfileId='different'},'profile_identity_unverified');
reject(p=>{p.profileId=''},'profile_identity_unverified');
reject(p=>{p.shadowComplete=false},'public_timeline_end_unproven');
reject(p=>{p.shadowPageInfoEnd=false},'public_timeline_end_unproven');
reject(p=>{p.expected=23},'public_timeline_counter_or_partition_mismatch');
reject(p=>{p.expected=0},'public_timeline_counter_or_partition_mismatch');
reject(p=>{p.publicReelIds=new Set()},'public_timeline_counter_or_partition_mismatch');
reject(p=>{p.publicReelIds=new Set(['100']);p.publicPostIds.delete('100')},
    'public_root_partition_invalid');
reject(p=>{p.reelsComplete=false},'connected_surfaces_not_equivalent');
reject(p=>{p.connectedHiddenComplete=false},'connected_surfaces_not_equivalent');
reject(p=>{p.ownedHydrationComplete=false},'connected_surfaces_not_equivalent');
reject(p=>{p.hiddenCandidates=1},'connected_surfaces_not_equivalent');
reject(p=>{p.hiddenRecovered=1},'connected_surfaces_not_equivalent');
reject(p=>{p.hiddenPreviewOnly=1},'connected_surfaces_not_equivalent');
reject(p=>{p.hiddenFailed=1},'connected_surfaces_not_equivalent');
reject(p=>{p.ownedPostIds.delete('100')},'public_roots_not_reconciled');
reject(p=>{p.ownedReelIds.delete('200')},'public_roots_not_reconciled');

const missing=base();
missing.ownedPostIds.delete('100');
missing.ownedPostIds.delete('101');
assert.equal(assess(missing).missing,2,'missing root count should be precise');

const bridge=extract('reconcileProfileGridCoverage');
assert.ok(bridge.includes('assessProfileGridCrossSurfaceProof'));
assert.ok(bridge.includes('state.coverage.profileGrid = true'));
assert.ok(bridge.includes('profileGrid') && bridge.includes('scanSelected'));
assert.ok(bridge.includes('state.shadow.rootIds'));
assert.ok(bridge.includes('state.roots.REEL'));
assert.ok(bridge.includes('state.coverage.connectedHidden'));
assert.ok(bridge.includes('state.coverage.ownedHydration'));

const shadow=extract('scanPublicShadow');
assert.ok(shadow.includes("state.shadow.pageInfoEnded = pageInfo?.has_next_page === false"));
assert.ok(shadow.includes('state.shadow.rootIds = new Set(roots.keys())'));
assert.ok(shadow.includes('state.shadow.profileId = String(state.userId'));
assert.ok(shadow.includes('if (state.coverage.publicShadow)'));

const reset=extract('resetCoverage');
for(const prop of [
    "state.shadow.profileId = '';",
    "state.shadow.pageInfoEnded = false;",
    "state.shadow.rootIds = new Set();",
    "state.shadow.postIds = new Set();",
    "state.shadow.reelIds = new Set();"
])assert.ok(reset.includes(prop),'reset missing: '+prop);

const scan=extract('scanAll');
const lastHydration=scan.indexOf("'DEEP HYDRATION'");
const reconcile=scan.indexOf('reconcileProfileGridCoverage();');
const verdict=scan.indexOf('const incomplete = incompleteCoverage();');
assert.ok(lastHydration>=0 && reconcile>lastHydration && verdict>reconcile,
    'cross-surface evidence may only be evaluated after all discovery and hydration');

const profile=extract('scanMainGrid');
assert.ok(profile.includes("navigationEnded = fallback.ended ===")||
    /navigationEnded\s*=\s*fallback.ended\s*===/.test(profile));
assert.ok(!bridge.includes('await fetch(') && !bridge.includes('webRelayGql('),
    'reconciliation must add no network requests');

console.log('PROFILE cross-surface coverage proof regression tests passed.');
