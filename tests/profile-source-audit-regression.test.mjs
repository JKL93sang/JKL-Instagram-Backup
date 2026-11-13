import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const marker='    function '+name+'(';
    const pos=src.indexOf(marker);
    assert.ok(pos>=0,'missing function '+name);
    const end=src.indexOf('\n    }\n',pos);
    assert.ok(end>pos,'missing function end '+name);
    return src.slice(pos,end+7);
}
const uid='43584047103',username='petit._tigre';
const pub=Array.from({length:89},(_,i)=>String(i+1000));
const native=Array.from({length:40},(_,i)=>String(i+1070));
const main=Array.from({length:115},(_,i)=>String(i+1000));
const dom=Array.from({length:25},(_,i)=>String(i+1090)).concat(['99999','untrusted-link']);
const reeltab=main.slice(0,52).concat(
    Array.from({length:309},(_,i)=>String(3000+i))
);
const state={
    username,userId:uid,expected:117,
    profileInfo:{media_count:117},
    shadow:{rootIds:new Set(pub),pageInfoEnded:true},
    coverage:{publicShadow:true},
    profileMainGridRootIds:new Set(main),
    profileDomObservedRootIds:new Set(dom),
};
const net={
    gridByUser:new Map([[username,new Map(native.map(id=>[id,{pk:id}]))]]),
    reelsByUserId:new Map([[uid,new Map(reeltab.map(id=>[id,{pk:id}]))]]),
    gridNativeAuditByUser:new Map([[username,{initial:1,lastHasNext:'true'}]]),
    gridPageInfo:new Map([[username,{has_next_page:true}]]),
};
const diagnostic=new Function('state','net',
    extract('profileSourceDiagnosticSnapshot')+
    '\nreturn profileSourceDiagnosticSnapshot;'
)(state,net);
const result=diagnostic();
assert.equal(result.kind,'PROFILE_SOURCE_DIAGNOSTICS_ONLY');
assert.equal(result.userId,uid);
assert.equal(result.account,username);
assert.equal(result.expectedAuthenticated,117);
assert.equal(result.nativeServerEnded,false);
assert.equal(result.publicServerEnded,true);
assert.deepEqual(result.counts,{
    public:89,
    native:40,
    domCandidates:26,
    mainGridSnapshot:115,
    independentNativeReels:361,
    publicNativeUnion:110,
    publicNativeOverlap:19,
    mainOutsidePublicNative:5,
    mainAlsoSeenInDom:25,
    mainAlsoInIndependentReels:52,
    observedUnionIncludingDomCandidates:116,
    gapMainVsCounter:2,
    gapPublicNativeVsCounter:7,
});
assert.equal(result.rootIds.public.length,89);
assert.equal(result.rootIds.native.length,40);
assert.equal(result.rootIds.mainGridSnapshot.length,115);
assert.equal(result.rootIds.independentNativeReels.length,361);
assert.ok(!result.rootIds.domCandidates.includes('untrusted-link'));
assert.ok(result.rootIds.domCandidates.includes('99999'));
assert.equal(JSON.parse(JSON.stringify(result)).rootIds.native.length,40,
    'all root source IDs must survive JSON export, unlike Set serialization');
assert.match(result.warning,/do not establish missing PROFILE identities/);

// A Reel seen only in the independent REELS tab cannot be added to
// an authenticated main-grid membership or fill the counter gap.
const gatedReel='3001';
assert.ok(result.rootIds.independentNativeReels.includes(gatedReel));
assert.ok(!result.rootIds.mainGridSnapshot.includes(gatedReel));
assert.equal(diagnostic().counts.gapMainVsCounter,2);
state.profileInfo.media_count=118;
assert.equal(diagnostic().expectedAuthenticated,null);
assert.equal(diagnostic().counts.gapMainVsCounter,null,
    'contradictory counter must never provide fake gap figures');
state.profileInfo.media_count=117;
net.gridPageInfo.get(username).has_next_page=false;
net.gridNativeAuditByUser.get(username).lastHasNext='false';
assert.equal(diagnostic().nativeServerEnded,true);
assert.equal(diagnostic().counts.gapMainVsCounter,2,
    'observing an end flag is not proof of missing identity');

assert.match(src,/profileMainGridRootIds\s*=\s*new Set\(\)/,
    'evidence must reset between profiles');
assert.match(src,/profileDomObservedRootIds\s*=\s*new Set\(\)/);
assert.match(src,/state\.profileMainGridRootIds = new Set\(\[\s*\.\.\.state\.roots\.POST,\s*\.\.\.state\.roots\.REEL/,
    'freeze main-grid membership before independently scanning REELS');
assert.match(src,/state\.profileDomObservedRootIds = new Set\(/);
assert.match(src,/profileSourceDiagnostics:\s*profileSourceDiagnosticSnapshot\(\)/,
    'manifest must include serializable source-specific root ID arrays');
assert.match(src,/PROFILE SOURCE AUDIT \(diagnostic only\)/);
assert.ok(!extract('profileSourceDiagnosticSnapshot').includes('gmRequest('));
assert.ok(!extract('profileSourceDiagnosticSnapshot').includes('nativeFetch('));
assert.equal(src.match(/\/\/ @version\s+([0-9.]+)/)?.[1],'1.5.111');
console.log('PROFILE source audit: 115/117 vs 89 PUBLIC/40 native/361 independent REELS, safe snapshots and JSON export — PASS.');
