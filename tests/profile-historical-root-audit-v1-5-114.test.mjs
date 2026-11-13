import fs from 'node:fs';
import assert from 'node:assert/strict';

// Synthetic provenance only: no real Instagram accounts or data.
const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const i=src.indexOf('    function '+name+'(');
    assert.ok(i>=0,'production helper '+name+' not found');
    const e=src.indexOf('\n    }\n',i);
    assert.ok(e>i,'missing production helper termination');
    return src.slice(i,e+7);
}
const alpha='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const encode=n=>{
    let i=BigInt(n),out='';
    while(i>0n){out=alpha[Number(i%64n)]+out;i/=64n;}
    return out;
};
const canonicalShortcode=s=>
    String(s||'').length>28 ? String(s).slice(0,-28) : String(s||'');
const shortcodeId=code=>{
    if(!code || !/^[\w-]+$/.test(code))return '';
    let id=0n;
    for(const x of code)id=id*64n+BigInt(alpha.indexOf(x));
    return id.toString();
};
const reconcile=new Function('canonicalShortcode','shortcodeId',
    extract('reconcileHistoricalProfileRoots')+
    '\nreturn reconcileHistoricalProfileRoots;'
)(canonicalShortcode,shortcodeId);
const root=(media,type,code,sources)=>({
    type,shortcode:code,sources,filename:media+'.jpg',
});
const ext=code=>code+'a'.repeat(28);
const ledger={
    '901':root('901','POST',encode(101),['PROFILE_GRID_NATIVE']),
    '902':root('902','POST',ext(encode(101)),['PROFILE_GRID_NATIVE']),
    '903':root('903','POST',encode(102),['PROFILE_GRID_DOM']),
    '904':root('904','POST',encode(105),['PROFILE_GRID_DOM']),
    '905':root('905','REEL',encode(103),['PROFILE_GRID_NATIVE']),
    '906':root('906','POST',encode(104),['TAGGED']),
    '907':root('907','HIGHLIGHT',encode(106),['PROFILE_GRID_NATIVE']),
    bad:{type:'POST',shortcode:'bogus',sources:['PROFILE_GRID_NATIVE']},
    '908':root('908','POST','invalid*',['PROFILE_GRID_NATIVE']),
    '909':{type:'POST',shortcode:encode(104),sources:null},
};
const input={ledger,main:['101'],reels:['103'],dom:['101','102','999'],
    native:['101','103'],currentMediaIds:['901','903','906'],expected:5,
    selectedPost:true,selectedReel:true};
const before=JSON.stringify(input);
const a=reconcile(input);
assert.equal(JSON.stringify(input),before,'diagnostic must never mutate inputs');
assert.equal(a.kind,'PROFILE_HISTORICAL_RECONCILIATION_DIAGNOSTIC');
assert.equal(a.historicalRootCount,4,'two media in same carousel count as one root');
assert.equal(a.historicalNativeProvenanceCount,2);
assert.equal(a.historicalDomOnlyCount,2);
assert.equal(a.currentObservedRootCount,2);
assert.equal(a.currentMatchedHistoricalRoots,2);
assert.equal(a.historicRootsAbsentFromCurrent,2);
assert.equal(a.historicNativeAbsent,0);
assert.equal(a.historicDomOnlyAbsent,2);
assert.equal(a.numericCounterVsHistory,1);
assert.equal(a.numericCounterVsCurrent,3);
assert.deepEqual(a.currentRootsWithNoHistoricalEvidence,[]);
assert.deepEqual(a.currentUnresolvedDomCandidateIds,['102','999']);
assert.deepEqual(a.missing.map(x=>x.rootId),['102','105']);
assert.equal(a.missing[0].status,'current_dom_candidate_unverified');
assert.equal(a.missing[0].currentQueuedHistoricalUnits,1,
    'even a queued child does not become a verified parent');
assert.equal(a.missing[1].status,'historical_root_not_in_current_selection');
assert.equal(a.missing[1].historicalUnits,1);
assert.match(a.warning,/not current server pagination/);
assert.ok(!extract('reconcileHistoricalProfileRoots').includes('addMedia('));
assert.ok(!extract('reconcileHistoricalProfileRoots').includes('fetch('));
assert.ok(!extract('reconcileHistoricalProfileRoots').includes('state.roots'));

const skip=reconcile({...input,selectedPost:false});
assert.equal(skip.kind,'PROFILE_HISTORICAL_COMPARISON_NOT_SELECTED');
assert.deepEqual(skip.missing,[],
    'TAGGED-only/reels-only cannot claim a historical PROFILE gap');
assert.match(skip.warning,/not establish PROFILE coverage/);

const noCount=reconcile({...input,expected:'NaN'});
assert.equal(noCount.numericCounterVsHistory,null);
assert.equal(noCount.numericCounterVsCurrent,null);
const unknown=reconcile({...input,main:['101','103','202'],reels:['103']});
assert.deepEqual(unknown.currentRootsWithNoHistoricalEvidence,['202']);
assert.equal(unknown.historicRootsAbsentFromCurrent,2);
assert.match(src,/profileHistoricalRootAudit:\s*profileHistoricalRootAudit\(\)/);
assert.match(src,/PROFILE HISTORICAL AUDIT \(read-only\)/);
assert.match(src,/PROFILE historic root not re-proven:/);
assert.match(src,/profileDomHydrationFailures:/);
assert.match(src,/state\.profileDomHydrationFailures = \[\]/);
assert.equal(src.match(/\/\/ @version\s+([0-9.]+)/)?.[1],'1.5.115');
console.log('Historical canonical parent evidence vs current PROFILE/REELS: PASS');

// Exercise REAL production hydration error accounting, without a network.
function extractAsync(name){
    const i=src.indexOf('    async function '+name+'(');
    assert.ok(i>=0,'production async helper '+name+' not found');
    const e=src.indexOf('\n    }\n',i);
    assert.ok(e>i);
    return src.slice(i,e+7);
}
async function failureCase(err,sourceHint='PROFILE_GRID_DOM',rejectionCode=''){
    const state={cancelled:false,userId:'100',feedbackRequired:false,
        rateLimited:false,profileDomHydrationFailures:[]};
    const logs=[];
    const run=new Function('state','APP','sleep','rand','shortcodeId',
        'canonicalShortcode','fetchOwnedMediaInfo',
        'verifiedTargetScopedProfileDomMediaInfo',
        'profileDomMediaInfoFailureCode','addMedia','updateStats','log',
        'feedbackCircuitBreak','rateLimitCircuitBreak','queuedUnitsForRoot',
        extractAsync('hydratePermalinkRoots')+
        '\nreturn hydratePermalinkRoots;'
    )(state,{HYDRATE_WORKERS:1},async()=>{},()=>0,shortcodeId,
        canonicalShortcode,async()=>{if(rejectionCode)return {pk:'123'};throw err;},
        ()=>false,()=>rejectionCode||'-',
        ()=>{},()=>{},x=>logs.push(x),e=>new Error(e),e=>new Error(e),
        ()=>0);
    const result=await run([
        {mediaId:'123',shortcode:encode(123),route:'p'}
    ],sourceHint);
    return {result,state,logs};
}
{
    const e=new Error('HTTP 404');e.status=404;
    const r=await failureCase(e);
    assert.deepEqual(r.result,{attempted:1,resolved:0,failed:1});
    assert.deepEqual(r.state.profileDomHydrationFailures,[{
        rootId:'123',shortcode:encode(123),
        reason:'http_error',httpStatus:404,
    }]);
}
{
    const r=await failureCase(new Error('network disabled'));
    assert.equal(r.state.profileDomHydrationFailures[0].reason,
        'media_info_unavailable');
    assert.equal(r.state.profileDomHydrationFailures[0].httpStatus,null);
}
{
    const e=new Error('HTTP 404');e.status=404;
    const r=await failureCase(e,'TAGGED');
    assert.deepEqual(r.state.profileDomHydrationFailures,[],
        'only PROFILE_GRID_DOM may contribute current DOM failures');
}
{
    const r=await failureCase(null,'PROFILE_GRID_DOM','incomplete_media_units');
    assert.equal(r.result.failed,1);
    assert.deepEqual(r.state.profileDomHydrationFailures,[{
        rootId:'123',shortcode:encode(123),
        reason:'incomplete_media_units',httpStatus:null,
    }], 'preserve exact sanitised reason for authenticated-but-incomplete carousel');
}
console.log('DOM hydration exact root & HTTP failure redaction: PASS');
