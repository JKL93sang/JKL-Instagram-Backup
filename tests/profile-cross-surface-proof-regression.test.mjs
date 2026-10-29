import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8'
);
function extract(name){
    let i=src.indexOf('    function '+name+'(');
    if(i<0)i=src.indexOf('    async function '+name+'(');
    assert.ok(i>=0,'function not found: '+name);
    const j=src.indexOf('\n    }\n',i);
    assert.ok(j>i,'function end missing: '+name);
    return src.slice(i,j+7);
}
const assess=new Function(
    extract('assessProfileGridCrossSurfaceProof')+
    '\nreturn assessProfileGridCrossSurfaceProof;'
)();
const mk=(count=22)=>{
    const posts=new Set(Array.from(
        {length:count-1},(_,i)=>String(1000+i)
    ));
    const reel=new Set(['2000']);
    return {
        selectedPost:true,selectedReel:true,
        publicProfile:true,exclusiveKnown:true,hasExclusive:false,
        shadowApplicable:true,profileId:'1234567',shadowProfileId:'1234567',
        shadowComplete:true,shadowPageInfoEnd:true,
        counterVerified:true,expected:count,
        publicRootIds:new Set([...posts,...reel]),
        publicPostIds:posts,publicReelIds:reel,
        reelsComplete:true,connectedHiddenComplete:true,
        ownedHydrationComplete:true,hiddenCandidates:0,hiddenRecovered:0,
        hiddenPreviewOnly:0,hiddenFailed:0,
        ownedPostIds:new Set(posts),
        ownedReelIds:new Set(['2000','2001','2002']),
        nativeRootIds:new Set(),nativeContinuationPages:0,
        nativePageInfoEnd:false,nativeLastHasNextFalse:false,
    };
};
const exact=assess(mk());
assert.deepEqual(exact,{
    verified:true,reason:'public_connected_cross_surface_proof',
    missing:0,publicCount:22,nativeCount:0,overlap:0,unionCount:22,
},'fully ended public timeline and connected surfaces must remain valid');

/*
 * Real 1.5.63 failure pattern:
 * PROFILE expected 25, PUBLIC SHADOW ended with 24 POST roots,
 * PROFILE native observer captured 13 roots, 12 of which overlap
 * the public 24; both sources report has_next_page=false.
 * 25 owned POST roots + 3 separately completed REELS.
 */
const mkUnion=()=>{
    const publicPosts=new Set(Array.from(
        {length:24},(_,i)=>String(3000+i)
    ));
    const missingPublicRoot='3024';
    const allPosts=new Set([...publicPosts,missingPublicRoot]);
    const nativePosts=new Set([
        ...Array.from({length:12},(_,i)=>String(3000+i)),
        missingPublicRoot
    ]);
    const p=mk();
    p.expected=25;
    p.publicRootIds=new Set(publicPosts);
    p.publicPostIds=new Set(publicPosts);
    p.publicReelIds=new Set();
    p.ownedPostIds=allPosts;
    p.ownedReelIds=new Set(['4000','4001','4002']);
    p.nativeRootIds=nativePosts;
    p.nativeContinuationPages=2;
    p.nativePageInfoEnd=true;
    p.nativeLastHasNextFalse=true;
    return p;
};
assert.deepEqual(assess(mkUnion()),{
    verified:true,reason:'public_native_union_cross_surface_proof',
    missing:0,publicCount:24,nativeCount:13,overlap:12,unionCount:25,
},'two complete independently scoped timelines must reconcile to 25');

const reject=(source,mutate,reason)=>{
    const p=source();mutate(p);
    const result=assess(p);
    assert.equal(result.verified,false,reason);
    assert.equal(result.reason,reason);
};
reject(mk,p=>{p.selectedPost=false},'post_and_reel_scans_required');
reject(mk,p=>{p.selectedReel=false},'post_and_reel_scans_required');
reject(mk,p=>{p.publicProfile=false},'public_access_equivalence_unavailable');
reject(mk,p=>{p.exclusiveKnown=false},'public_access_equivalence_unavailable');
reject(mk,p=>{p.hasExclusive=true},'public_access_equivalence_unavailable');
reject(mk,p=>{p.shadowApplicable=false},'public_access_equivalence_unavailable');
reject(mk,p=>{p.shadowProfileId='other'},'profile_identity_unverified');
reject(mk,p=>{p.profileId=''},'profile_identity_unverified');
reject(mk,p=>{p.shadowComplete=false},'public_timeline_end_unproven');
reject(mk,p=>{p.shadowPageInfoEnd=false},'public_timeline_end_unproven');
reject(mk,p=>{p.counterVerified=false},'public_timeline_counter_or_partition_mismatch');
reject(mk,p=>{p.expected=0},'public_timeline_counter_or_partition_mismatch');
reject(mk,p=>{p.expected=21},'public_timeline_counter_or_partition_mismatch');
reject(mk,p=>{p.publicReelIds=new Set()},'public_timeline_counter_or_partition_mismatch');
reject(mk,p=>{p.publicReelIds=new Set(['1000'])},'public_root_partition_invalid');
reject(mk,p=>{p.reelsComplete=false},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.connectedHiddenComplete=false},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.ownedHydrationComplete=false},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.hiddenCandidates=1},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.hiddenRecovered=1},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.hiddenPreviewOnly=1},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.hiddenFailed=1},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.ownedPostIds.delete('1000')},'public_roots_not_reconciled');
reject(mk,p=>{p.ownedReelIds.delete('2000')},'public_roots_not_reconciled');
const missing=mk();missing.ownedPostIds.delete('1000');
missing.ownedPostIds.delete('1001');
assert.equal(assess(missing).missing,2);

/* A public timeline containing 24 of 25 never suffices alone. */
reject(mkUnion,p=>{p.nativeContinuationPages=0},'authenticated_native_end_unproven');
reject(mkUnion,p=>{p.nativePageInfoEnd=false},'authenticated_native_end_unproven');
reject(mkUnion,p=>{p.nativeLastHasNextFalse=false},'authenticated_native_end_unproven');
reject(mkUnion,p=>{p.nativeRootIds=new Set()},'authenticated_native_end_unproven');
reject(mkUnion,p=>{p.nativeRootIds=new Set(['3024'])},'public_native_overlap_unproven');
reject(mkUnion,p=>{p.nativeRootIds=new Set(['INVALID','3000'])},'authenticated_native_identity_invalid');
reject(mkUnion,p=>{p.nativeRootIds.add('9999')},'authenticated_native_roots_not_reconciled');
reject(mkUnion,p=>{p.nativeRootIds.delete('3024')},'public_native_union_counter_mismatch');
reject(mkUnion,p=>{p.nativeRootIds.add('3000');p.nativeRootIds.delete('3024')},'public_native_union_counter_mismatch');
reject(mkUnion,p=>{p.ownedPostIds.delete('3024')},'authenticated_native_roots_not_reconciled');
reject(mkUnion,p=>{p.expected=26},'public_native_union_counter_mismatch');
reject(mkUnion,p=>{p.shadowPageInfoEnd=false},'public_timeline_end_unproven');
reject(mkUnion,p=>{p.hiddenCandidates=1},'connected_surfaces_not_equivalent');

const bridge=extract('reconcileProfileGridCoverage');
const profile=extract('scanMainGrid');
const shadow=extract('scanPublicShadow');
const reset=extract('resetCoverage');
const scan=extract('scanAll');
assert.ok(bridge.includes('assessProfileGridCrossSurfaceProof'));
assert.ok(bridge.includes('state.coverage.profileGrid = true'));
assert.ok(bridge.includes('net.gridByUser.get(state.username.toLowerCase())'));
assert.ok(bridge.includes('net.gridPageInfo.get('));
assert.ok(bridge.includes('net.gridNativeAuditByUser.get('));
assert.ok(bridge.includes("Number(state.profileInfo.media_count)"));
assert.ok(bridge.includes('state.roots.POST'));
assert.ok(bridge.includes('state.roots.REEL'));
assert.ok(bridge.includes('state.coverage.ownedHydration'));
assert.ok(bridge.includes("result.reason"));
assert.ok(shadow.includes('state.shadow.rootIds = new Set(roots.keys())'));
assert.ok(shadow.includes('state.shadow.pageInfoEnded = pageInfo?.has_next_page === false'));
for(const key of ['profileId','pageInfoEnded','rootIds','postIds','reelIds'])
    assert.ok(reset.includes('state.shadow.'+key+' = '),'reset missing '+key);
const phase=scan.indexOf("'DEEP HYDRATION'");
const recon=scan.indexOf('reconcileProfileGridCoverage();');
const verdict=scan.indexOf('const incomplete = incompleteCoverage();');
assert.ok(phase>=0 && recon>phase && verdict>recon);
assert.ok(!bridge.includes('await fetch(') && !bridge.includes('webRelayGql('));
assert.ok(profile.includes("fallback.ended ==="));
console.log('PROFILE cross-surface proof: public exact and native/public union tests passed.');
