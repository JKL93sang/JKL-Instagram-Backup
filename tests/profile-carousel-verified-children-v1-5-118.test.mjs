import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
  const i=src.indexOf('    function '+name+'(');
  assert.ok(i>=0,'missing production function '+name);
  const j=src.indexOf('\n    }\n',i);
  assert.ok(j>i,'unterminated '+name);
  return src.slice(i,j+7);
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function encode(decimal) {
  let n=BigInt(decimal),s='';
  do {s=alphabet[Number(n%64n)]+s;n/=64n;}while(n>0n);
  return s;
}
const decode=code=>{
  let x=0n;
  for(const c of code) {
    const i=alphabet.indexOf(c);
    if(i<0)return '';
    x=x*64n+BigInt(i);
  }
  return x.toString();
};
const pk=o=>String(o?.pk || o?.id || '').split('_')[0];
const short=c=>String(c || '').replace(/_suffix-no-such-string$/,'');
const code=encode('654321');
const ids=['70001','70002','70003','70004','70005'];
const makeChildren=()=>ids.map(id=>({pk:id,media_type:1,carousel_parent_id:'654321'}));
const native={pk:'654321',code,media_type:8,carousel_media_count:6,
    carousel_media:makeChildren()};
const mkState=()=>({
    username:'testprofile',userId:'13579',profileInfo:{pk:'13579'},
    scanPlan:{post:true},coverage:{profileGrid:false,ownedHydration:true},
    roots:{POST:new Set(['654321']),REEL:new Set()},
    rootCatalog:new Map(),queue:new Map(),
    verifiedNativeAccessibleCarouselMediaIds:new Set(),
    nativeProfileEvidenceSession:{key:'testprofile',userId:'13579',
        acceptedAt:1000,acceptedCapturedAt:900},
    cancelled:false,feedbackRequired:false,rateLimited:false,apiUnhealthy:false,
});
function build() {
    const state=mkState();
    const rec={id:'654321',type:'POST',shortcode:code,
        sources:new Set(['PROFILE_GRID_NATIVE','OWNED_DEEP_HYDRATION']),
        hydratedByApi:true,structureComplete:true,forceHydrate:false,
        expectedUnits:5,apiUnits:5,declaredUnitsHint:6,
        knownUnitIds:new Set(ids)};
    state.rootCatalog.set(rec.id,rec);
    for(const id of ids)state.queue.set(id,{
        id,type:'POST',ext:'jpg',filename:id+'.jpg',
        url:'https://example.test/'+id+'.jpg',
        rootIds:new Set([rec.id]),
        sources:new Set(['PROFILE_GRID_NATIVE','OWNED_DEEP_HYDRATION']),
    });
    const net={gridByUser:new Map([['testprofile',new Map([['654321',native]])]]),
        gridNativeAuditByUser:new Map([['testprofile',{initial:1,continuation:10}]]),
        gridCaptureSeenAtByUser:new Map([['testprofile',1500]])};
    const logs=[];
    const funcs=new Function('state','net','normalizePk','canonicalShortcode',
        'shortcodeId','queuedUnitsForRoot','scanSelected','log',
        extract('nativeHydratedCarouselChildProof')+'\n'+
        extract('reconcileNativeHydratedCarouselChildren')+'\n'+
        'return {nativeHydratedCarouselChildProof,reconcileNativeHydratedCarouselChildren};'
    )(state,net,pk,short,decode,id=>[...state.queue.values()]
        .filter(m=>m.rootIds.has(id)).length,()=>true,(...xs)=>logs.push(xs));
    return {state,net,rec,logs,...funcs};
}
{
    const x=build();
    assert.deepEqual(x.nativeHydratedCarouselChildProof(native,x.rec),{
        ok:true,reason:'five_accessible_children_two_sources',
        ids,declared:6,accessible:5
    });
    x.reconcileNativeHydratedCarouselChildren();
    assert.deepEqual([...x.state.verifiedNativeAccessibleCarouselMediaIds],ids);
    assert.equal(x.state.coverage.profileGrid,false,
        'five authorized units never authorize PROFILE grid completeness');
    assert.equal(x.state.queue.size,5,'no invented sixth child');
}
for(const [label,mutate] of [
    ['no fresh api hydration',x=>{x.rec.hydratedByApi=false;}],
    ['not structurally verified',x=>{x.rec.structureComplete=false;}],
    ['wrong native parent',x=>{x.net.gridByUser.get('testprofile').get('654321').pk='999999';}],
    ['wrong authentic owner',x=>{x.net.gridByUser.get('testprofile').get('654321').user={pk:'54321'};}],
    ['unrelated profile API',x=>{x.state.profileInfo.pk='54321';}],
    ['wrong code',x=>{x.rec.shortcode=encode('654322');}],
    ['missing native child',x=>{x.net.gridByUser.get('testprofile').get('654321').carousel_media.pop();}],
    ['native child changed',x=>{x.net.gridByUser.get('testprofile').get('654321').carousel_media[0]={pk:'888888',media_type:1};}],
    ['child without deep source',x=>{x.state.queue.get('70001').sources.delete('OWNED_DEEP_HYDRATION');}],
    ['unverified queued url',x=>{x.state.queue.get('70001').url='';}],
    ['wrong root membership',x=>{x.state.queue.get('70001').rootIds.clear();}],
    ['changed declared count',x=>{x.rec.declaredUnitsHint=5;}],
    ['extra independent native ID',x=>{
        x.net.gridByUser.get('testprofile').get('654321').carousel_media_ids=[...ids,'70006'];
    }],
    ['native continuation pending',x=>{
        x.net.gridByUser.get('testprofile').get('654321').edge_sidecar_to_children=
            {page_info:{has_next_page:true}};
    }],
    ['wrong slide parent',x=>{
        x.net.gridByUser.get('testprofile').get('654321').carousel_media[1].carousel_parent_id='777777';
    }],
    ['deleted slide',x=>{
        x.net.gridByUser.get('testprofile').get('654321').carousel_media[1].deleted_reason=1;
    }],
    ['stale capture',x=>{x.net.gridCaptureSeenAtByUser.set('testprofile',500);}],
    ['not hydrated selected surface',x=>{x.state.coverage.ownedHydration=false;}],
]) {
    const x=build();
    // Avoid mutation of shared native fixture between cases.
    x.net.gridByUser.set('testprofile',new Map([['654321',structuredClone(native)]]));
    mutate(x);
    x.reconcileNativeHydratedCarouselChildren();
    assert.equal(x.state.verifiedNativeAccessibleCarouselMediaIds.size,0,label);
}
assert.match(src,/state\.verifiedNativeAccessibleCarouselMediaIds\.has\(id\)/);
assert.match(src,/nativeHydratedChildProven/);
assert.match(src,/nativeAccessibleCarouselChildren:/);
const scan=src.slice(src.indexOf('    async function scanAll('),
    src.indexOf('    function unverifiedArchiveHistory('));
assert.ok(scan.indexOf('reconcileNativeHydratedCarouselChildren();')>
    scan.indexOf('reconcilePassiveProfilePostRoots();'));
assert.equal(src.match(/\/\/ @version\s+([0-9.]+)/)?.[1],'1.5.118');
console.log('Two independent native/deep sources grant 5 existing children only; 18 negative guards and zero false completeness: PASS');
