import fs from 'node:fs';
import assert from 'node:assert/strict';

// Real production functions, mocked offline browser traffic only.
// No Instagram request, account data, or real browser interactions.
const source=fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8'
);
function extract(name) {
    const m=new RegExp('    (?:async )?function '+name+'\\(').exec(source);
    assert.ok(m,'missing production function '+name);
    const end=source.indexOf('\n    }\n',m.index);
    assert.ok(end>=m.index,'unclosed '+name);
    return source.slice(m.index,end+7);
}
const APP={PROFILE_BOOTSTRAP_MAX_AGE_MS:20000};
function fixture() {
    const uid='45790055326';
    const state={
        userId:uid,username:'jennnii97',
        scanPlan:{post:false,reel:true,tagged:false,highlight:false,
            story:false,avatar:false},
        coverage:{publicShadow:false,ownedHydration:false,reels:false},
        shadow:{applicable:false,pageInfoEnded:false,profileId:'',
            postIds:new Set()},
        queue:new Map(),verifiedPassiveReelRootIds:new Set(),
        roots:{POST:new Set(),REEL:new Set(),TAGGED:new Set(),STORY:new Set(),
            HIGHLIGHT:new Set(),AVATAR:new Set()},
        highlightCatalog:new Map(),
    };
    const net={
        reelsByUserId:new Map(),reelPageInfo:new Map(),
        reelNativeAuditByUserId:new Map(),
        reelNativeInitialByUserId:new Map(),
        reelNativeContinuationByUserId:new Map(),
        reelCaptureSeenAtByUserId:new Map(),
        reelBootstrapConsumedByUserId:new Set(),
    };
    const normalizePk=x=>String(x?.pk||x?.id||'').split('_')[0];
    const capture=new Function('state','net','REEL_NAMES','cleanUser',
        'currentProfile','reelConn','edgeNode','normalizePk',
        extract('requestTargetsCurrentProfile')+
        extract('reelUserId')+
        extract('reelNativeCursorField')+
        extract('captureReels')+
        '\nreturn captureReels;'
    )(state,net,new Set(['PolarisProfileReelsTabContentQuery']),
        x=>String(x||'').replace(/^@/,''),
        ()=>state.username,d=>d.conn,e=>e.node,normalizePk);
    const prepare=new Function('net','APP',
        extract('prepareReelsNativeEvidenceForScan')+
        '\nreturn prepareReelsNativeEvidenceForScan;'
    )(net,APP);

    const addMedia=(raw,type,origin)=>{
        const rootId=normalizePk(raw);
        state.roots.REEL.add(rootId);
        if(!raw.url) return;
        const old=state.queue.get(rootId);
        if(old) {
            old.sources.add(origin);
            old.rootIds.add(rootId);
        } else {
            state.queue.set(rootId,{
                id:rootId,type,filename:rootId+'.mp4',
                url:raw.url,rootIds:new Set([rootId]),
                sources:new Set([origin]),
            });
        }
    };
    const verify=new Function('state','normalizePk',
        extract('discoveredMediaResolution')+
        '\nreturn discoveredMediaResolution;'
    )(state,normalizePk);
    const logs=[];
    const scanner=new Function(
        'state','net','location','window','pathNorm','findAnchor',
        'log','status','normalizePk','addMedia',
        'discoveredMediaResolution','updateStats',
        extract('scanReels')+'\nreturn scanReels;'
    )(state,net,{pathname:'/jennnii97/'},{scrollY:0},
        x=>String(x).replace(/\/+$/,''),
        ()=>null,(...x)=>logs.push(x),()=>{},
        normalizePk,addMedia,verify,()=>{});
    const selected=new Function('state','mediaArchiveCategory',
        extract('verifiedAccessibleMedia')+
        '\nreturn verifiedAccessibleMedia;'
    )(state,m=>({
        REEL:'REELS',POST:'POSTS',HIGHLIGHT:'HIGHLIGHTS',
        STORY:'STORIES',TAGGED:'TAGGED',AVATAR:'AVATAR',
    })[m?.type]||'MEDIA');

    function observe(roots,targetId=uid) {
        capture({
            conn:{
                edges:roots.map(node=>({node})),
                page_info:{has_next_page:false,end_cursor:''},
            },
        },{
            friendly:'PolarisProfileReelsTabContentQuery',
            variables:{target_user_id:targetId},
            docId:'12345',bodyFields:{doc_id:'12345'},relayHeaders:{},
            endpoint:'api',
        });
    }
    return {state,net,logs,uid,observe,prepare,scanner,selected};
}
{
    const x=fixture();
    x.observe([
        {pk:'111',url:'https://example.test/111.mp4'},
        {pk:'222',url:'https://example.test/222.mp4'},
    ]);
    assert.equal(x.net.reelsByUserId.get(x.uid).size,2);
    // A new initial native page must NOT union old page-load roots.
    x.observe([{pk:'333',url:'https://example.test/333.mp4'}]);
    assert.equal(x.net.reelsByUserId.get(x.uid).size,1,
        'fresh initial page discards stale roots');
    x.observe([{pk:'999',url:'https://example.test/999.mp4'}],'OTHER_USER');
    assert.equal(x.net.reelsByUserId.get(x.uid).size,1,
        'other account cannot inject native Reel roots');

    const captured=x.net.reelCaptureSeenAtByUserId.get(x.uid);
    assert.equal(x.prepare(x.uid,captured+1000).retained,true);
    assert.equal(x.net.reelBootstrapConsumedByUserId.has(x.uid),true);
    assert.equal(await x.scanner(),false,'no tab => never claim full Reels');
    assert.equal(x.state.coverage.reels,false);
    assert.deepEqual([...x.state.verifiedPassiveReelRootIds],['333']);
    assert.deepEqual(x.selected().map(m=>m.id),['333'],
        'one genuinely observed native Reel may join partial archive');
    assert.ok(x.logs.some(x=>x[0].includes('native_observed=1')));
    assert.equal(x.prepare(x.uid,captured+1500).retained,false,
        'one-shot bootstrap may not be replayed in a later scan');
    assert.equal(x.net.reelsByUserId.get(x.uid).size,0);
}
{
    const x=fixture();
    x.observe([{pk:'444',url:'https://example.test/444.mp4'}]);
    const captured=x.net.reelCaptureSeenAtByUserId.get(x.uid);
    assert.equal(x.prepare(x.uid,captured+APP.PROFILE_BOOTSTRAP_MAX_AGE_MS+1)
        .retained,false,'stale bootstrap rejected');
    assert.equal(x.net.reelsByUserId.get(x.uid).size,0);
    assert.equal(await x.scanner(),false);
    assert.equal(x.selected().length,0);
}
{
    const x=fixture();
    x.observe([{pk:'555'}]);
    const captured=x.net.reelCaptureSeenAtByUserId.get(x.uid);
    assert.equal(x.prepare(x.uid,captured+1).retained,true);
    assert.equal(await x.scanner(),false);
    assert.equal(x.state.roots.REEL.has('555'),true,
        'keep root for existing deeper hydration pass');
    assert.equal(x.state.verifiedPassiveReelRootIds.size,0,
        'inaccessible media payload not made download-eligible');
    assert.equal(x.selected().length,0);
    assert.ok(x.logs.some(x=>x[0].includes('native_unresolved=1')));
}
{
    const x=fixture();
    x.observe([{pk:'777',url:'https://example.test/777.mp4'}]);
    const captured=x.net.reelCaptureSeenAtByUserId.get(x.uid);
    assert.equal(x.prepare(x.uid,captured-100).retained,false,
        'capture timestamps from the future must not be trusted');
}
console.log('One-shot native Reels bootstrap, identity, TTL and safe partial recovery — PASS');
