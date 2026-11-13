import fs from 'node:fs';
import assert from 'node:assert/strict';

// Synthetic identities only: no real private-profile identifiers or data.
const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const start=src.indexOf('    function '+name+'(');
    assert.ok(start>=0,'missing production helper '+name);
    const end=src.indexOf('\n    }\n',start);
    assert.ok(end>start);
    return src.slice(start,end+7);
}
const now=Date.now();
const id='123456';
const ids=['111','222','333'];
const userKey='sample_account';
const request={
    docId:'123456789',
    variables:{username:userKey,count:12},
};
const continuation={
    docId:'987654321',
    variables:{username:userKey,first:12,after:'opaque-cursor'},
};
const state={
    username:userKey,userId:id,
    profileInfo:{pk:id,is_private:true},expected:4,
    roots:{POST:new Set(['111','222']),REEL:new Set(['333'])},
    nativeProfileEvidenceSession:{
        key:userKey,userId:id,acceptedAt:now-20000,
        acceptedCapturedAt:now-18000,
    },
};
const net={
    gridByUser:new Map([[userKey,new Map(ids.map(id=>[id,{pk:id}]))]]),
    gridPageInfo:new Map([[userKey,{has_next_page:false,end_cursor:null}]]),
    gridNativeAuditByUser:new Map([[userKey,{
        initial:1,continuation:10,lastHasNext:'false',
    }]]),
    gridNativeInitialByUser:new Map([[userKey,request]]),
    gridNativeContinuationByUser:new Map([[userKey,continuation]]),
    gridCaptureSeenAtByUser:new Map([[userKey,now-5000]]),
};
const target=({variables})=>variables?.username===state.username;
const proof=new Function('state','net','requestTargetsCurrentProfile',
    extract('profileNativeTerminalCounterGapProof')+
    '\nreturn profileNativeTerminalCounterGapProof;')(state,net,target);
const gap={required:true,reasons:['native_below_ig_counter']};
const original=JSON.stringify({state,
    native:[...net.gridByUser.get(userKey).keys()]});
assert.deepEqual(proof(gap),{
    verified:true,reason:'native_end_counter_gap',observed:3,expected:4,
});
assert.equal(JSON.stringify({state,
    native:[...net.gridByUser.get(userKey).keys()]}),original,
    'read-only proof must not alter archive, parent roots or counters');

assert.equal(proof({required:false,reasons:[]}).verified,false);
assert.equal(proof({required:true,reasons:['native_end_unproven',
    'native_below_ig_counter']}).verified,false,
    'native end missing must not be silently substituted');
state.expected=3;
assert.equal(proof(gap).verified,false,
    'exact counter reconciliation must not be re-labeled a gap');
state.expected=4;
net.gridPageInfo.get(userKey).has_next_page=true;
assert.equal(proof(gap).verified,false);
net.gridPageInfo.get(userKey).has_next_page=false;
net.gridNativeAuditByUser.get(userKey).lastHasNext='unknown';
assert.equal(proof(gap).verified,false);
net.gridNativeAuditByUser.get(userKey).lastHasNext='false';
net.gridNativeInitialByUser.delete(userKey);
assert.equal(proof(gap).verified,false);
net.gridNativeInitialByUser.set(userKey,request);
state.profileInfo.pk='987654';
assert.equal(proof(gap).verified,false);
state.profileInfo.pk=id;
state.roots.POST.delete('222');
assert.equal(proof(gap).verified,false,
    'unresolved native parents cannot be silently treated as verified');
state.roots.POST.add('222');
net.gridCaptureSeenAtByUser.set(userKey,now-200000);
assert.equal(proof(gap).verified,false,
    'outdated previous-session pagination is not current proof');
net.gridCaptureSeenAtByUser.set(userKey,now-5000);
net.gridNativeContinuationByUser.set(userKey,
    {...continuation,variables:{username:'other_account',after:'cursor'}});
assert.equal(proof(gap).verified,false,
    'profile identity cross-check remains strict');
net.gridNativeContinuationByUser.set(userKey,continuation);
assert.equal(proof(gap).verified,true);

const main=extract('profileCompletionRequirement');
assert.match(main,/native_below_ig_counter/,
    'authenticated counter mismatch stays visible');
const scan=src.slice(src.indexOf('    async function scanMainGrid('),
    src.indexOf('    function currentReelsProgress('));
assert.match(scan,/profileNativeTerminalCounterGapProof\(completionRequirement\)/,
    'real scan must invoke the verified no-replay guard');
assert.ok(scan.indexOf('profileNativeTerminalCounterGapProof(completionRequirement)') <
    scan.indexOf('await scanProfileGraphQLFallback('),
    'must guard before making another request');
assert.match(scan,/navigationEnded = false;/,
    'counter gap must not get a false complete by no-replay');
assert.match(scan,/continuing REELS and media hydration/,
    'other scan phases must still run');
assert.equal(src.match(/\/\/ @version\s+([0-9.]+)/)?.[1],'1.5.118');
console.log('Native PROFILE terminal counter gap: no unsafe replay, no false COMPLETE, scoped proof & continuation: PASS');
