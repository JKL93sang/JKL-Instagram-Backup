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
 * Real 1.5.65 failure pattern (public PROFILE test):
 * 124 distinct PUBLIC SHADOW roots, all provisionally POST;
 * authenticated REELS confirms 14 of them as REEL and adds 1
 * separate Reel. Owned membership is therefore POST=110, REEL=15,
 * OWNED=125 and every one of the 124 public IDs is accounted for.
 * This is a valid independent public/connected proof, not 14 missing.
 */
const mkReclassified=()=>{
    const p=mk(124);
    const allPublicPosts=new Set(
        Array.from({length:124},(_,i)=>String(5000+i))
    );
    const asPosts=new Set(
        Array.from({length:110},(_,i)=>String(5000+i))
    );
    const promotedReels=new Set(
        Array.from({length:14},(_,i)=>String(5110+i))
    );
    p.expected=124;
    p.publicRootIds=allPublicPosts;
    p.publicPostIds=allPublicPosts;
    p.publicReelIds=new Set();
    p.ownedPostIds=asPosts;
    p.ownedReelIds=new Set([...promotedReels,'8000']);
    return p;
};
const reclassified=mkReclassified();
assert.equal(reclassified.ownedPostIds.size,110);
assert.equal(reclassified.ownedReelIds.size,15);
assert.equal(
    new Set([...reclassified.ownedPostIds,...reclassified.ownedReelIds]).size,
    125
);
assert.deepEqual(assess(reclassified),{
    verified:true,reason:'public_connected_cross_surface_proof',
    missing:0,publicCount:124,nativeCount:0,overlap:0,unionCount:124,
},'a public POST promoted to authenticated REEL must not become missing');

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
const independentReels = mk();
independentReels.reelsComplete = false;
assert.deepEqual(assess(independentReels), exact,
    'main-grid completion must not depend on the independent REELS tab');
reject(mk,p=>{p.connectedHiddenComplete=false},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.ownedHydrationComplete=false},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.hiddenCandidates=1},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.hiddenRecovered=1},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.hiddenPreviewOnly=1},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.hiddenFailed=1},'connected_surfaces_not_equivalent');
reject(mk,p=>{p.ownedPostIds.delete('1000')},'public_roots_not_reconciled');
reject(mk,p=>{p.ownedReelIds.delete('2000')},'public_roots_not_reconciled');
reject(mk,p=>{
    p.ownedReelIds.delete('2000');
    p.ownedPostIds.add('2000');
},'public_roots_not_reconciled');
reject(mkReclassified,p=>{
    p.ownedReelIds.delete('5110');
},'public_roots_not_reconciled');
reject(mkReclassified,p=>{
    p.ownedPostIds.delete('5000');
},'public_roots_not_reconciled');
const mainGridWithIndependentReels = mkReclassified();
mainGridWithIndependentReels.reelsComplete = false;
assert.deepEqual(assess(mainGridWithIndependentReels), assess(reclassified),
    'unknown REELS tab must not invalidate identity-proven main-grid roots');
reject(mkReclassified,p=>{
    p.shadowPageInfoEnd=false;
},'public_timeline_end_unproven');
reject(mkReclassified,p=>{
    p.expected=123;
},'public_timeline_counter_or_partition_mismatch');
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

/*
 * Regression from 2026-11-11 @petit._tigre read-only manifest and TXT:
 * public=89, native=105, overlap=79, union=115, main=115/117;
 * owned main=63 POST + 52 REEL; independent REELS=361 (309 off-grid).
 * Synthetic IDs/categories below match these cardinalities only:
 * they do NOT reproduce the actual private/public root-ID lists or
 * establish what the two unidentified PROFILE posts might be.
 */
{
    const publicIds = Array.from({length:89},(_,i)=>String(1000+i));
    const nativeExtra = Array.from({length:26},(_,i)=>String(5000+i));
    const nativeIds = [...publicIds.slice(0,79),...nativeExtra];
    const publicPostIds = new Set(publicIds.slice(0,46));
    const publicReelIds = new Set(publicIds.slice(46));
    const ownedPosts = new Set([...publicPostIds,...nativeExtra.slice(0,17)]);
    const mainReels = new Set([...publicReelIds,...nativeExtra.slice(17)]);
    const independentReels = new Set([
        ...mainReels,
        ...Array.from({length:309},(_,i)=>String(8000+i)),
    ]);
    assert.equal(publicIds.length,89);
    assert.equal(nativeIds.length,105);
    assert.equal(new Set([...publicIds,...nativeIds]).size,115);
    assert.equal(ownedPosts.size,63);
    assert.equal(mainReels.size,52);
    assert.equal(independentReels.size,361);
    assert.equal(ownedPosts.size+independentReels.size,424);
    const sample = {
        ...mk(117),
        expected:117,
        publicRootIds:new Set(publicIds),
        publicPostIds,publicReelIds,
        nativeRootIds:new Set(nativeIds),
        nativeContinuationPages:8,
        nativePageInfoEnd:true,
        nativeLastHasNextFalse:true,
        ownedPostIds:ownedPosts,
        ownedReelIds:independentReels,
    };
    const result=assess(sample);
    assert.deepEqual(result,{
        verified:false,
        reason:'public_native_union_counter_mismatch',
        missing:2,
    }, 'two server-ended timelines and an independently completed 361-REEL tab must NOT become a 117/117 main-grid proof');
    // 309 REELS observed outside main never increase the expected main union.
    sample.ownedReelIds.add('999999');
    assert.equal(assess(sample).reason,'public_native_union_counter_mismatch');
    // Adding unverified native roots without reconciling their OWNED identity
    // must fail before claiming completion.
    sample.nativeRootIds.add('999998');
    sample.nativeRootIds.add('999997');
    assert.equal(assess(sample).reason,'authenticated_native_roots_not_reconciled');
    // Only synthetic counterfactual: two genuinely verified extra main roots
    // could satisfy the proof. Never infer these IDs from real manifest data.
    sample.ownedPostIds.add('999998');
    sample.ownedPostIds.add('999997');
    const hypothetical=assess(sample);
    assert.equal(hypothetical.verified,true);
    assert.equal(hypothetical.reason,'public_native_union_cross_surface_proof');
    assert.equal(hypothetical.unionCount,117);
}

/*
 * Regression from 2026-11-12 @petit._tigre v1.5.102 real TXT+manifest:
 * public=89, native=93, overlap=67 => verified union=115 of 117.
 * Exactly 2 additional main POST roots were visible as DOM permalinks
 * and resolved through per-root media-info; main snapshot=117.
 * Those two roots have 3 and 6 child photos respectively (9 unledgered
 * files). The observer's DOM candidates are NOT native pagination proof,
 * regardless of the successful per-root media-info or 780 indexed files.
 * Synthetic IDs here encode only the observed counts, never a fake
 * assertion about the real Instagram content or downloaded files.
 */
{
    const pub=Array.from({length:89},(_,i)=>String(11000+i));
    const nativeExtra=Array.from({length:26},(_,i)=>String(22000+i));
    const native=[...pub.slice(0,67),...nativeExtra];
    const domOnly=['33001','33002'];
    const pubPosts=new Set(pub.slice(0,46));
    const pubReels=new Set(pub.slice(46));
    const ownedPosts=new Set([...pubPosts,...nativeExtra.slice(0,17),...domOnly]);
    const mainReels=new Set([...pubReels,...nativeExtra.slice(17)]);
    const independentReels=new Set([
        ...mainReels,...Array.from({length:309},(_,i)=>String(44000+i))
    ]);
    const authenticated=new Set([...pub,...native]);
    const observedMain=new Set([...authenticated,...domOnly]);
    assert.equal(pub.length,89);
    assert.equal(native.length,93);
    assert.equal(new Set(pub.filter(x=>native.includes(x))).size,67);
    assert.equal(authenticated.size,115);
    assert.equal(observedMain.size,117);
    assert.equal(ownedPosts.size,65);
    assert.equal(mainReels.size,52);
    assert.equal(independentReels.size,361);
    assert.equal(ownedPosts.size+independentReels.size,426);
    assert.equal(3+6,9,'the two DOM-only carousels contribute nine children');
    const p={
        ...mk(117),
        expected:117,
        publicRootIds:new Set(pub),
        publicPostIds:pubPosts, publicReelIds:pubReels,
        nativeRootIds:new Set(native),
        nativeContinuationPages:8,
        nativePageInfoEnd:true,nativeLastHasNextFalse:true,
        ownedPostIds:ownedPosts,ownedReelIds:independentReels,
    };
    assert.deepEqual(assess(p),{
        verified:false,
        reason:'public_native_union_counter_mismatch',
        missing:2,
    },'a 117/117 DOM-main snapshot and 426 owned roots must NOT override 115/117 public/native evidence');
    // Even if DOM root IDs are known and their per-root fetch yielded 9
    // downloadable files, this does not promote them into nativeRootIds.
    assert.ok(domOnly.every(id=>!p.nativeRootIds.has(id) &&
        !p.publicRootIds.has(id) && p.ownedPostIds.has(id)));
}

const bridge=extract('reconcileProfileGridCoverage');
const profile=extract('scanMainGrid');
const shadow=extract('scanPublicShadow');
const reset=extract('resetCoverage');
const scan=extract('scanAll');
assert.ok(bridge.includes('assessProfileGridCrossSurfaceProof'));
assert.ok(!src.includes('!proof.reelsComplete ||'),
    'PROFILE must not falsely require REELS completeness to prove the grid');
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
