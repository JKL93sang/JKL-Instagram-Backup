import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const marker='    function '+name+'(';
    const pos=src.indexOf(marker);
    assert.ok(pos>=0,'missing '+name);
    const end=src.indexOf('\n    }\n',pos);
    assert.ok(end>pos,'missing end of '+name);
    return src.slice(pos,end+7);
}
const uid='57732395174',user='aphrodixiaa';
const publicIds=Array.from({length:32},(_,i)=>String(1000+i));
const nativeIds=[...publicIds.slice(0,22),'1032','1033'];
const extraReels=Array.from({length:63},(_,i)=>String(2000+i));
const state={
    username:user,userId:uid,expected:34,
    profileInfo:{pk:uid,media_count:34,is_private:false},
    exclusive:{known:true,hasExclusiveFeedContent:false},
    coverage:{profileGrid:false,publicShadow:true,connectedHidden:true,
        reels:true,ownedHydration:true,tagged:true,highlights:true,
        story:true,avatar:true},
    shadow:{applicable:true,pageInfoEnded:true,profileId:uid,
        rootIds:new Set(publicIds),
        postIds:new Set(publicIds.slice(0,30)),
        reelIds:new Set(publicIds.slice(30))},
    roots:{POST:new Set([...publicIds.slice(0,30),'1032']),
        REEL:new Set([...publicIds.slice(30),'1033',...extraReels])},
    hidden:{candidates:0,recovered:0,previewOnly:0,failed:0},
    scanPlan:{post:true,reel:true,tagged:true,highlight:true,story:true,avatar:true},
    cancelled:false,feedbackRequired:false,rateLimited:false,apiUnhealthy:false,
    queue:new Map(Array.from({length:203},(_,i)=>{
        const id=String(i+1);
        return [id,{id,url:'https://cdn.example.test/'+id,
            filename:id+'.jpg',verified:true}];
    })),
    nativeProfileEvidenceSession:{key:user,userId:uid,
        acceptedAt:Date.now()-60000,acceptedCapturedAt:1234567},
    scanOutcome:'EXPOSED_COMPLETE',scanComplete:true,
    scanUserId:uid,scanQueueSize:203,scanQueueFingerprint:'current-fingerprint',
    reelsDiagnosis:{kind:'OBSERVED'},
};
const net={gridByUser:new Map([[user,new Map(nativeIds.map(id=>[id,{pk:id}]))]]),
    gridNativeAuditByUser:new Map([[user,{initial:1,continuation:1,lastHasNext:'true'}]]),
    gridCaptureSeenAtByUser:new Map([[user,1234567]])};
const plan=state.scanPlan;
const modes={COMPLETE:'complete'};
const scanDownloadFingerprint=()=>state.queue.size===203
    ? 'current-fingerprint' : 'changed-fingerprint';
const api=new Function('state','net','scanSelected','scanSelection',
    'verifiedAccessibleMedia','DOWNLOAD_MODE','scanDownloadFingerprint',
    'verifiedPartialDownloadIntegrity',
    ['profilePublicGapAvoidsSyntheticRelay','requiredCoverage',
     'reelsSurfaceSkipped','ownedIds','profileSurfaceOperationalSkip',
     'incompleteCoverage','completedScanIntegrity','authorizeDownloadScope']
    .map(extract).join('\n')+
    '\nreturn {profileSurfaceOperationalSkip,incompleteCoverage,authorizeDownloadScope};'
)(state,net,k=>plan[k]===true,()=>plan,
    ()=>[...state.queue.values()].filter(m=>m.verified),
    modes,scanDownloadFingerprint,()=>({ok:false,reason:'unexpected partial route'}));

assert.equal(state.roots.POST.size,31);
assert.equal(state.roots.REEL.size,66);
assert.equal(new Set([...publicIds,...nativeIds]).size,34);
assert.equal(api.profileSurfaceOperationalSkip(),true,
    'the exact Firefox 34/34 inventory with 203/203 source-verified files');
assert.deepEqual(api.incompleteCoverage(),[],
    'only an operational skip, all other selected surfaces are complete');
assert.equal(state.coverage.profileGrid,false,
    'NEVER synthesize native page_info.has_next_page=false');
assert.equal(api.authorizeDownloadScope('complete').ok,true,
    'exposed-only standard download must be available without retrying Instagram');

function deny(label,change,restore) {
    change();
    assert.equal(api.profileSurfaceOperationalSkip(),false,label);
    assert.ok(api.incompleteCoverage().includes('PROFILE grid'),label);
    assert.equal(api.authorizeDownloadScope('complete').ok,false,label);
    restore();
    assert.equal(api.profileSurfaceOperationalSkip(),true,label+' restored');
}
deny('one of 203 media not individually verified',()=>{
    state.queue.get('203').verified=false;
},()=>{state.queue.get('203').verified=true;});
deny('union only 33 of 34',()=>{
    net.gridByUser.get(user).delete('1033');
},()=>{net.gridByUser.get(user).set('1033',{pk:'1033'});});
deny('native capture from another session',()=>{
    state.nativeProfileEvidenceSession.userId='other';
},()=>{state.nativeProfileEvidenceSession.userId=uid;});
deny('changed native capture timestamp',()=>{
    net.gridCaptureSeenAtByUser.set(user,5555555);
},()=>{net.gridCaptureSeenAtByUser.set(user,1234567);});
deny('wrong account',()=>{
    state.profileInfo.pk='other';
},()=>{state.profileInfo.pk=uid;});
deny('hidden content still pending',()=>{
    state.hidden.candidates=1;
},()=>{state.hidden.candidates=0;});
deny('Reels connection unfinished',()=>{
    state.coverage.reels=false;
},()=>{state.coverage.reels=true;});
deny('TAGGED connection unfinished',()=>{
    state.coverage.tagged=false;
},()=>{state.coverage.tagged=true;});
deny('possible exclusive media',()=>{
    state.exclusive.hasExclusiveFeedContent=true;
},()=>{state.exclusive.hasExclusiveFeedContent=false;});
deny('public pagination not server-ended',()=>{
    state.shadow.pageInfoEnded=false;
},()=>{state.shadow.pageInfoEnded=true;});
deny('authenticated counter disagreement',()=>{
    state.profileInfo.media_count=35;
},()=>{state.profileInfo.media_count=34;});
deny('native source unverified',()=>{
    net.gridNativeAuditByUser.get(user).initial=0;
    net.gridNativeAuditByUser.get(user).continuation=0;
},()=>{
    net.gridNativeAuditByUser.get(user).initial=1;
    net.gridNativeAuditByUser.get(user).continuation=1;
});
assert.ok(src.includes('VERIFIED EXPOSED ARCHIVE (PROFILE SERVER-END UNPROVEN)'));
assert.ok(src.includes('const profileSkipped = profileSurfaceOperationalSkip()'));
assert.ok(!state.coverage.profileGrid,'remain visibly unknown');
console.log('Verified exposed archive operational result 203/203, strict revocations and unknown PROFILE pagination — PASS.');
