import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8'
);
function extract(name) {
    const m=new RegExp('    (?:async )?function '+name+'\\(').exec(src);
    assert.ok(m,'missing source function '+name);
    const end=src.indexOf('\n    }\n',m.index);
    assert.ok(end>m.index,'missing source ending '+name);
    return src.slice(m.index,end+7);
}
const units=Array.from({length:6},(_,i)=>String(910001+i));
const uid='57732395174',username='aphrodixiaa',nativeId='980001';
function fixture(options={}) {
    const raw={
        pk:nativeId,media_type:8,carousel_media_count:6,
        carousel_media:units.map(pk=>({pk})),
    };
    const now=Date.now();
    const state={
        username,userId:uid,expected:34,cancelled:false,
        feedbackRequired:false,rateLimited:false,apiUnhealthy:false,
        scanPlan:{post:true,reel:true},
        profileInfo:{pk:uid,is_private:false},
        shadow:{applicable:true,pageInfoEnded:true,profileId:uid,
            postIds:new Set(['100001'])},
        coverage:{publicShadow:true,profileGrid:false,ownedHydration:true,reels:true},
        verifiedPassiveProfilePostRootIds:new Set(),
        roots:{POST:new Set(['100001',nativeId]),REEL:new Set(),
            TAGGED:new Set(),STORY:new Set(),HIGHLIGHT:new Set(),AVATAR:new Set()},
        queue:new Map(),rootCatalog:new Map(),highlightCatalog:new Map(),
        nativeProfileEvidenceSession:{
            key:username,userId:uid,
            acceptedAt:now-49000,acceptedCapturedAt:now-50000,
        },
    };
    state.queue.set('100001',{
        id:'100001',type:'POST',filename:'public.jpg',
        url:'https://cdn.example/public',
        sources:new Set(['PROFILE_PUBLIC_SHADOW']),
        rootIds:new Set(['100001']),
    });
    for(const id of units) {
        state.queue.set(id,{
            id,type:'POST',filename:id+'.jpg',
            url:'https://cdn.example/'+id,
            sources:new Set(['PROFILE_GRID_NATIVE']),
            rootIds:new Set([nativeId]),
        });
    }
    state.rootCatalog.set(nativeId,{
        id:nativeId,type:'POST',sources:new Set(['PROFILE_GRID_NATIVE']),
        expectedUnits:6,structureComplete:true,forceHydrate:false,
    });
    const net={
        gridByUser:new Map([[username,new Map([[nativeId,raw]])]]),
        gridNativeAuditByUser:new Map([[username,{initial:1,continuation:1}]]),
        gridCaptureSeenAtByUser:new Map([[username,now-50000]]),
    };
    const logs=[];
    const methods=[
        'normalizePk','queuedUnitsForRoot','discoveredMediaResolution',
        'reconcilePassiveProfilePostRoots','mediaArchiveCategory',
        'verifiedAccessibleMedia','accessibleSourceProofFingerprint',
    ].map(extract).join('\n');
    const f=new Function('state','net','scanSelected','log',
        methods+'\nreturn {reconcilePassiveProfilePostRoots,'+
        'verifiedAccessibleMedia,accessibleSourceProofFingerprint};'
    )(state,net,which=>state.scanPlan?.[which]===true,
      (...a)=>logs.push(a));
    options.mutate?.({state,net,raw,units,uid,nativeId});
    return {state,net,raw,logs,...f};
}
{
    const x=fixture();
    const pre=x.verifiedAccessibleMedia();
    assert.deepEqual(pre.map(m=>m.id),['100001'],
        'native-only post needs its own verified evidence');
    x.reconcilePassiveProfilePostRoots();
    assert.deepEqual([...x.state.verifiedPassiveProfilePostRootIds],[nativeId]);
    const eligible=x.verifiedAccessibleMedia();
    assert.equal(eligible.length,7,
        'six individually proven native carousel children plus one public file');
    assert.equal(x.state.coverage.profileGrid,false,
        'individual proof must never fake PROFILE server-end');
    assert.ok(x.logs.some(v=>String(v[0]).includes(
        'PROFILE individually verified native POST roots=1, media=6'
    )));
    const fingerprint=x.accessibleSourceProofFingerprint();
    assert.ok(fingerprint.includes('"passiveProfilePosts":["'+nativeId+'"]'),
        'immutable source fingerprint includes exact verified native post roots');
    x.state.verifiedPassiveProfilePostRootIds.clear();
    assert.equal(x.verifiedAccessibleMedia().length,1,
        'clearing proven roots removes ALL six private native-only files');
    assert.notEqual(x.accessibleSourceProofFingerprint(),fingerprint,
        'grant must be invalidated by proof-set mutation');
}
for(const [label,mutate] of [
    ['wrong authenticated target ID',({state})=>{state.profileInfo.pk='other';}],
    ['mismatched scan identity',({state})=>{state.nativeProfileEvidenceSession.userId='other';}],
    ['mismatched scan profile',({state})=>{state.nativeProfileEvidenceSession.key='other';}],
    ['old unrelated response',({state,net})=>{
        net.gridCaptureSeenAtByUser.set(username,Date.now()-100000);
    }],
    ['no real native capture audit',({net})=>{net.gridNativeAuditByUser.clear();}],
    ['unknown native target',({net})=>{net.gridByUser.clear();}],
    ['unhydrated collection',({state})=>{state.coverage.ownedHydration=false;}],
    ['cancelled scan',({state})=>{state.cancelled=true;}],
    ['feedback_required',({state})=>{state.feedbackRequired=true;}],
    ['api unhealthy',({state})=>{state.apiUnhealthy=true;}],
    ['missing archived child',({state})=>{state.queue.delete(units[0]);}],
    ['missing URL on child',({state})=>{state.queue.get(units[0]).url='';}],
    ['wrong child source',({state})=>{state.queue.get(units[0]).sources.clear();}],
    ['wrong child parent',({state})=>{state.queue.get(units[0]).rootIds.clear();}],
    ['native root only preview',({raw})=>{raw.carousel_media.pop();}],
    ['carousel claims more children than observed',({raw})=>{raw.carousel_media_count=7;}],
    ['unfinished sidecar pagination',({raw})=>{
        raw.edge_sidecar_to_children={page_info:{has_next_page:true}};
    }],
    ['unresolved root structure',({state})=>{
        state.rootCatalog.get(nativeId).structureComplete=false;
    }],
    ['root still needs hydration',({state})=>{
        state.rootCatalog.get(nativeId).forceHydrate=true;
    }],
    ['root no longer tagged native',({state})=>{
        state.rootCatalog.get(nativeId).sources.clear();
    }],
    ['root not POST',({state})=>{state.rootCatalog.get(nativeId).type='REEL';}],
    ['root not owned',({state})=>{state.roots.POST.delete(nativeId);}],
    ['changed identity key',({net})=>{
        net.gridByUser.get(username).delete(nativeId);
        net.gridByUser.get(username).set('other', {pk:nativeId,
            media_type:8,carousel_media_count:6,
            carousel_media:units.map(pk=>({pk}))});
    }],
]) {
    const x=fixture({mutate});
    x.reconcilePassiveProfilePostRoots();
    assert.equal(x.state.verifiedPassiveProfilePostRootIds.size,0,label);
    assert.deepEqual(x.verifiedAccessibleMedia().map(m=>m.id),
        x.state.coverage.ownedHydration===true ? ['100001'] : [],
        'no unverified native-only units and no unhydrated PUBLIC item: '+label);
}
{
    // A second fake child in queue must not be counted as proof just
    // because the six genuine child IDs exist.
    const x=fixture();
    x.state.queue.set('extra-unit',{
        id:'extra-unit',type:'POST',filename:'extra.jpg',
        url:'https://cdn.example/extra',
        sources:new Set(['PROFILE_GRID_NATIVE']),
        rootIds:new Set([nativeId]),
    });
    x.reconcilePassiveProfilePostRoots();
    assert.equal(x.state.verifiedPassiveProfilePostRootIds.size,0);
}
console.log('Native PROFILE individual POST/carousel partial provenance regressions passed.');
