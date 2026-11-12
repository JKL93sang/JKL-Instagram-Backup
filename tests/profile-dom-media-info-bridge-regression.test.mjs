import fs from 'node:fs';
import assert from 'node:assert/strict';

// Real production functions are executed with inert, synthetic fixtures.
// No Instagram HTTP requests or browser downloads are ever performed.
const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name){
    let i=src.indexOf('    function '+name+'(');
    if(i<0)i=src.indexOf('    async function '+name+'(');
    assert.ok(i>=0,'missing production function '+name);
    const j=src.indexOf('\n    }\n',i);
    assert.ok(j>i,'unterminated production function '+name);
    return src.slice(i,j+7);
}
const uid='43584047103',username='petit._tigre';
const functions=['normalizePk','canonicalShortcode','shortcodeId',
    'standaloneFilename','standaloneUnits',
    'verifiedTargetScopedProfileDomMediaInfo',
    'assessProfileGridCrossSurfaceProof',
    'assessProfileDomApiSupplementProof'].map(extract).join('\n');
const methods=new Function('APP','state','cleanUser','currentProfile',
    'rootKind','isVideo','bestVideo','bestImage','sanitize','datePart',
    functions+'\nreturn {verifiedTargetScopedProfileDomMediaInfo,'+
    'assessProfileGridCrossSurfaceProof,assessProfileDomApiSupplementProof};'
)({PRIVATE_PERMALINK_SUFFIX_LENGTH:28},{username},x=>String(x||''),
    ()=>username,x=>x.product_type==='clips'?'REEL':'POST',
    ()=>false,()=>'',x=>x.url||'',x=>String(x),()=>'2026_11_12');

const mkItem=(id,code,n)=>({
    pk:id,code,product_type:'feed',media_type:8,carousel_media_count:n,
    user:{pk:uid,username},
    carousel_media:Array.from({length:n},(_,i)=>({
        pk:String(BigInt(id)-BigInt(100+i)),
        url:'https://cdn.example/'+id+'/'+i+'.jpg',
    })),
});
const domRows=[
    {id:'3153889526261377396',code:'CvE3dBpoml0',children:3},
    {id:'3285109440665201171',code:'C2XDaGLIaoT',children:6},
];
for(const {id,code,children} of domRows){
    const info={mediaId:id,shortcode:code,route:'p'};
    const item=mkItem(id,code,children);
    assert.equal(methods.verifiedTargetScopedProfileDomMediaInfo(info,item,uid),true,
        'exact same-owner+root+code media-info with full carousel must validate');
    for(const [reason,mutate] of [
        ['wrong owner',x=>{x.user.pk='99999';}],
        ['owner omitted',x=>{delete x.user;}],
        ['different root PK',x=>{x.pk='1';}],
        ['bad code',x=>{x.code='OtherWrong';}],
        ['classified REEL',x=>{x.product_type='clips';}],
        ['missing child',x=>{x.carousel_media.pop();}],
        ['duplicate child',x=>{x.carousel_media[1].pk=x.carousel_media[0].pk;}],
        ['child no url',x=>{x.carousel_media[0].url='';}],
        ['pending child pagination',x=>{x.edge_sidecar_to_children={page_info:{has_next_page:true}};}],
    ]){
        const invalid=structuredClone(item);
        mutate(invalid);
        assert.equal(methods.verifiedTargetScopedProfileDomMediaInfo(info,invalid,uid),false,
            id+' must reject '+reason);
    }
    assert.equal(methods.verifiedTargetScopedProfileDomMediaInfo(
        {...info,route:'reel'},item,uid),false);
    assert.equal(methods.verifiedTargetScopedProfileDomMediaInfo(
        {...info,shortcode:'wrong'},item,uid),false);
}

function scenario(){
    // Real 2026-11-12 cardinalities, synthetic IDs only for the
    // pre-existing 115 roots. The two DOM-only root IDs are exact.
    const pub=Array.from({length:89},(_,i)=>String(11000+i));
    const native=[...pub.slice(0,67),
        ...Array.from({length:26},(_,i)=>String(22000+i))];
    const nativeExtras=native.slice(67);
    const extra=domRows.map(x=>x.id);
    const all=new Set([...pub,...native,...extra]);
    const pubPosts=new Set(pub.slice(0,46));
    const pubReels=new Set(pub.slice(46));
    const ownedPosts=new Set([...pubPosts,...nativeExtras.slice(0,17),...extra]);
    const mainReels=new Set([...pubReels,...nativeExtras.slice(17)]);
    const ownedReels=new Set([...mainReels,
        ...Array.from({length:309},(_,i)=>String(44000+i))]);
    assert.equal(new Set([...pub,...native]).size,115);
    assert.equal(all.size,117);
    assert.equal(ownedPosts.size,65);
    assert.equal(mainReels.size,52);
    assert.equal(ownedReels.size,361);
    return {
        strict:{
            selectedPost:true,selectedReel:true,publicProfile:true,
            exclusiveKnown:true,hasExclusive:false,shadowApplicable:true,
            profileId:uid,shadowProfileId:uid,
            shadowComplete:true,shadowPageInfoEnd:true,
            counterVerified:true,expected:117,
            publicRootIds:new Set(pub), publicPostIds:pubPosts,
            publicReelIds:pubReels,
            nativeRootIds:new Set(native),nativeContinuationPages:8,
            nativePageInfoEnd:true,nativeLastHasNextFalse:true,
            connectedHiddenComplete:true,ownedHydrationComplete:true,
            hiddenCandidates:0,hiddenRecovered:0,hiddenPreviewOnly:0,
            hiddenFailed:0,ownedPostIds:ownedPosts,ownedReelIds:ownedReels,
        },
        mainRootIds:all,domObservedRootIds:new Set(all),
        verifiedDomApiRootIds:new Set(extra),
    };
}
function resultFor(x){
    const base=methods.assessProfileGridCrossSurfaceProof(x.strict);
    return {base,result:methods.assessProfileDomApiSupplementProof({
        base,expected:x.strict.expected,
        publicRootIds:x.strict.publicRootIds,
        nativeRootIds:x.strict.nativeRootIds,
        mainRootIds:x.mainRootIds,
        domObservedRootIds:x.domObservedRootIds,
        verifiedDomApiRootIds:x.verifiedDomApiRootIds,
        ownedPostIds:x.strict.ownedPostIds,
        ownedReelIds:x.strict.ownedReelIds,
    })};
}
const happy=scenario();
const {base,result}=resultFor(happy);
assert.deepEqual(base,{verified:false,reason:'public_native_union_counter_mismatch',
    missing:2},'PUBLIC and native alone must reject 115/117');
assert.deepEqual(result,{
    verified:true,reason:'public_native_dom_api_exact_counter_proof',
    missing:0,publicCount:89,nativeCount:93,
    overlap:67,unionCount:117,domApiSupplementCount:2,
});
const mutated=[
    ['only one individually verified DOM root',x=>x.verifiedDomApiRootIds.delete(domRows[0].id)],
    ['candidate missing from main',x=>x.mainRootIds.delete(domRows[0].id)],
    ['candidate missing from DOM',x=>x.domObservedRootIds.delete(domRows[1].id)],
    ['a DOM link was external to main',x=>x.domObservedRootIds.add('999123')],
    ['main has an independent REELS-only root',x=>{
        x.mainRootIds.delete(domRows[0].id);x.mainRootIds.add('44000');}],
    ['DOM-only root reclassified into REEL',x=>{
        x.strict.ownedPostIds.delete(domRows[0].id);
        x.strict.ownedReelIds.add(domRows[0].id);}],
    ['a root has lost its POST identity',x=>x.strict.ownedPostIds.delete(domRows[0].id)],
    ['missing native pagination end',x=>x.strict.nativePageInfoEnd=false],
    ['missing native continuation',x=>x.strict.nativeContinuationPages=0],
    ['native end flag unproven',x=>x.strict.nativeLastHasNextFalse=false],
    ['PUBLIC page has not ended',x=>x.strict.shadowPageInfoEnd=false],
    ['wrong account',x=>x.strict.shadowProfileId='unrelated'],
    ['private account',x=>x.strict.publicProfile=false],
    ['exclusive media',x=>x.strict.hasExclusive=true],
    ['hydration incomplete',x=>x.strict.ownedHydrationComplete=false],
    ['hidden preview unresolved',x=>x.strict.hiddenPreviewOnly=1],
    ['counter changed',x=>{x.strict.expected=118;}],
];
for(const [name,mutate] of mutated){
    const x=scenario();mutate(x);
    assert.equal(resultFor(x).result.verified,false,
        'hybrid completion must fail closed: '+name);
}
const hydration=extract('hydratePermalinkRoots');
const reconcile=extract('reconcileProfileGridCoverage');
const scan=extract('scanAll');
assert.ok(hydration.includes('verifiedTargetScopedProfileDomMediaInfo'));
assert.ok(hydration.includes('verifiedProfileDomApiRootIds.add(id)'));
assert.ok(hydration.includes('throw new Error'));
assert.ok(reconcile.includes('assessProfileGridCrossSurfaceProof'));
assert.ok(reconcile.includes('assessProfileDomApiSupplementProof'));
assert.ok(reconcile.indexOf('assessProfileDomApiSupplementProof')>
    reconcile.indexOf('assessProfileGridCrossSurfaceProof'));
assert.ok(scan.includes('state.verifiedProfileDomApiRootIds = new Set()'));
assert.ok(src.includes('verifiedProfileDomApiRootIds?.clear?.()'));
assert.ok(!reconcile.includes('await fetch('));
assert.ok(!reconcile.includes('webRelayGql('));

// Real PROFILE reconciliation function, not only the pure helper.
function integratedScan({mutate}={}){
    const x=scenario();
    const state={
        username,userId:uid,expected:117,
        coverage:{profileGrid:false,publicShadow:true,connectedHidden:true,
            ownedHydration:true,reels:true},
        profileInfo:{pk:uid,media_count:117,is_private:false},
        exclusive:{known:true,hasExclusiveFeedContent:false},
        shadow:{applicable:true,profileId:uid,pageInfoEnded:true,
            rootIds:x.strict.publicRootIds,postIds:x.strict.publicPostIds,
            reelIds:x.strict.publicReelIds},
        hidden:{candidates:0,recovered:0,previewOnly:0,failed:0},
        roots:{POST:x.strict.ownedPostIds,REEL:x.strict.ownedReelIds},
        profileMainGridRootIds:x.mainRootIds,
        profileDomObservedRootIds:x.domObservedRootIds,
        verifiedProfileDomApiRootIds:x.verifiedDomApiRootIds,
    };
    const net={
        gridByUser:new Map([[username,new Map(
            [...x.strict.nativeRootIds].map(id=>[id,{pk:id}]))]]),
        gridNativeAuditByUser:new Map([[username,{
            continuation:8,lastHasNext:'false'}]]),
        gridPageInfo:new Map([[username,{has_next_page:false}]]),
    };
    mutate?.({state,net,x});
    const logs=[];
    const run=new Function('state','net','scanSelected',
        'assessProfileGridCrossSurfaceProof',
        'assessProfileDomApiSupplementProof','log',
        extract('reconcileProfileGridCoverage')+
        '\nreturn reconcileProfileGridCoverage;'
    )(state,net,()=>true,methods.assessProfileGridCrossSurfaceProof,
        methods.assessProfileDomApiSupplementProof,(...a)=>logs.push(a));
    run();
    return {state,logs};
}
const actual=integratedScan();
assert.equal(actual.state.coverage.profileGrid,true,
    'verified DOM media-info supplement must close precisely this two-root gap');
assert.ok(actual.logs.some(([line])=>
    line.includes('proof=public_native_dom_api_exact_counter_proof')));
assert.ok(actual.logs.some(([line])=>
    line.includes('2 same-owner DOM media-info POST roots')));
for(const [name,mutate] of [
    ['single verified DOM media-info',({state})=>
        state.verifiedProfileDomApiRootIds.delete(domRows[0].id)],
    ['wrong counter',({state})=>{state.profileInfo.media_count=118;}],
    ['no native end',({net})=>
        net.gridPageInfo.get(username).has_next_page=true],
    ['hidden preview',({state})=>{state.hidden.previewOnly=1;}],
    ['unrelated main tile',({state})=>
        state.profileMainGridRootIds.add('999999')],
]){
    const x=integratedScan({mutate});
    assert.equal(x.state.coverage.profileGrid,false,
        'integrated completion must fail closed: '+name);
}

// Execute real hydratePermalinkRoots() through its normal media-info,
// structure and set-update path (no browser network).
{
    const state={
        userId:uid,cancelled:false,feedbackRequired:false,
        rateLimited:false,apiUnhealthy:false,
        rootCatalog:new Map(),roots:{POST:new Set()},
        verifiedProfileDomApiRootIds:new Set(),
    };
    const logs=[],called=[];
    const hydrate=new Function('state','APP','rand','sleep',
        'fetchOwnedMediaInfo','shortcodeId',
        'verifiedTargetScopedProfileDomMediaInfo','addMedia',
        'queuedUnitsForRoot','updateStats','log',
        extract('hydratePermalinkRoots')+'\nreturn hydratePermalinkRoots;'
    )(state,{HYDRATE_WORKERS:1},()=>0,async()=>{},
      async id=>{
          called.push(id);
          const v=domRows.find(x=>x.id===id);
          return mkItem(id,v.code,v.children);
      },
      code=>domRows.find(x=>x.code===code)?.id||'',
      methods.verifiedTargetScopedProfileDomMediaInfo,
      (item,forced,source)=>{
          assert.equal(source,'PROFILE_GRID_DOM');
          const n=item.carousel_media.length;
          state.roots.POST.add(item.pk);
          state.rootCatalog.set(item.pk,{type:'POST',
              structureComplete:true,forceHydrate:false,expectedUnits:n});
      },
      id=>domRows.find(x=>x.id===id)?.children||0,
      ()=>{},(...v)=>logs.push(v));
    const list=domRows.map(x=>({
        mediaId:x.id,shortcode:x.code,route:'p',
    }));
    const result=await hydrate(list,'PROFILE_GRID_DOM');
    assert.deepEqual(result,{attempted:2,resolved:2,failed:0});
    assert.deepEqual(called,domRows.map(x=>x.id));
    assert.deepEqual([...state.verifiedProfileDomApiRootIds],
        domRows.map(x=>x.id));
}

console.log('v1.5.103 PROFILE strict DOM media-info bridge / source-end + 17 fail-closed cases: PASS');
