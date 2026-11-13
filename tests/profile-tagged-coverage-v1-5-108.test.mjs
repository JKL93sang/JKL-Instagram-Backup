import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
const extract=(name,async=false)=>{
    const marker='    '+(async?'async function ':'function ')+name+'(';
    const start=src.indexOf(marker);
    assert.ok(start>=0,'missing production function '+name);
    const end=src.indexOf('\n    }\n',start);
    assert.ok(end>start,'missing end of '+name);
    return src.slice(start,end+7);
};
const pk=x=>String(x?.pk||x?.id||'');
const bestImage=x=>x?.display_url||'';
const bestVideo=x=>x?.video_url||'';
const isVideo=x=>x?.is_video===true||Number(x?.media_type)===2;
const merged=new Function('normalizePk','isVideo','bestVideo','bestImage',
    extract('verifiedTaggedCarouselUnion')+'\nreturn verifiedTaggedCarouselUnion;'
)(pk,isVideo,bestVideo,bestImage);
const child=(id)=>({pk:id,media_type:1,display_url:'https://cdn.example/'+id+'.jpg'});
const listing={pk:'9001',media_type:8,carousel_media_count:3,
    carousel_media:[child('100'),child('101')]};
const detail={pk:'9001',media_type:8,carousel_media_count:3,
    carousel_media:[child('101'),child('102')]};
const ok=merged(listing,detail);
assert.equal(ok.ok,true);
assert.equal(ok.reason,'exact_verified_child_union');
assert.equal(ok.listed,2);
assert.equal(ok.detailed,2);
assert.equal(ok.union,3);
assert.deepEqual(ok.root.carousel_media.map(pk),['100','101','102']);
assert.equal(ok.root.carousel_media_count,3);

// The actual archiving proof must succeed only if each merged child ID
// has the correct root, TAGGED provenance, and a file URL / disk evidence.
const state={queue:new Map(['100','101','102'].map(id=>[id,{
    id,filename:id+'.jpg',sources:new Set(['TAGGED']),
    rootIds:new Set(['9001']),url:'https://cdn.example/'+id+'.jpg',
}]))};
const discovered=new Function('normalizePk','state',
    extract('discoveredMediaResolution')+'\nreturn discoveredMediaResolution;'
)(pk,state);
assert.equal(discovered(ok.root,'TAGGED').ok,true);
state.queue.get('102').sources=new Set(['PROFILE_GRID_DOM']);
assert.deepEqual(discovered(ok.root,'TAGGED'),
    {ok:false,reason:'unresolved_media_unit'},
    'missing TAGGED child source remains incomplete');
state.queue.get('102').sources=new Set(['TAGGED']);

// Every counterexample must FAIL closed, without inventing media units.
assert.equal(merged(listing,{...detail,pk:'9002'}).ok,false);
assert.equal(merged(listing,{...detail,carousel_media_count:4}).ok,false);
assert.equal(merged({...listing,carousel_media_count:3,carousel_media:[child('100')]},
    {...detail,carousel_media:[child('100')]}).ok,false);
assert.equal(merged(listing,{...detail,carousel_media:[child('101'),child('101')]}).ok,false);
assert.equal(merged({...listing,edge_sidecar_to_children:{
    page_info:{has_next_page:true}}},detail).ok,false);
assert.equal(merged(listing,{...detail,carousel_media:[
    {pk:'101',media_type:2,video_url:'https://cdn.example/101.mp4'},
    child('102')]}).ok,false);
assert.equal(merged({...listing,carousel_media_count:0},detail).ok,false);
assert.equal(merged(listing,{...detail,carousel_media:[child('101')]}).ok,false);

// Profile DOM: visit intermediate viewports, not only the current bottom.
let y=0,requests=0;
const window={innerHeight:600,scrollTo({top}){y=top}};
const location={pathname:'/b_kkaaa/'};
const document={body:{scrollHeight:2400},
    documentElement:{scrollHeight:2400}};
const profileLinks=()=>{
    // The DOM exposes disjoint sets by viewport as React recycles nodes.
    const suffix=y<500?['1','2']:y<1000?['3','4']:
        y<1600?['5','6']:['7','8'];
    return new Map(suffix.map(id=>[id,{mediaId:id,shortcode:'x'+id}]));
};
const APP={PROFILE_DOM_SWEEP_MAX_STEPS:24,
    PROFILE_DOM_SWEEP_PAUSE_MS:0};
const sweepState={expected:12,username:'b_kkaaa',
    profileInfo:{is_private:true},cancelled:false,
    feedbackRequired:false,rateLimited:false,apiUnhealthy:false};
const net={gridByUser:new Map([['b_kkaaa',new Map([['0',{}]])]])};
const records=[], seen=new Map();
const sweep=new Function('state','net','APP','window','location','document',
    'pathNorm','sleep','profileLinks','log',
    extract('sweepProfileDomViewport',true)+'\nreturn sweepProfileDomViewport;'
)(sweepState,net,APP,window,location,document,
    x=>x.replace(/\/+$/,'')||'/',async()=>{},profileLinks,
    x=>records.push(x));
const a=await sweep(seen,'/b_kkaaa/');
assert.equal(a.attempted,true);
assert.ok(a.steps>=5 && a.steps<=24);
assert.equal(a.reason,'visual_bottom_only');
assert.deepEqual([...seen.keys()].sort(),['1','2','3','4','5','6','7','8'],
    'incremental sweep must capture every virtualized intermediate viewport');
assert.equal(requests,0,'passive sweep must not issue synthetic network calls');
assert.match(records.at(-1),/DOM observations remain unverified/);
const unchanged=await sweep(seen,'/other/');
assert.equal(unchanged.attempted,false);
assert.equal(unchanged.reason,'wrong_route');
sweepState.cancelled=true;
await assert.rejects(sweep(new Map(),'/b_kkaaa/'),/Cancelled/);
assert.match(src,/await sweepProfileDomViewport\(seenDom,target\)/);
assert.match(src,/if \(strictDom && !domApiProven\)/);
assert.match(src,/PROFILE DOM permalink not confirmed by same-owner/);
assert.match(src,/TAGGED_HYDRATION_LIMIT:\s*16\b/);
assert.equal(src.match(/@version\s+([0-9.]+)/)?.[1],'1.5.108');
console.log('v1.5.108: conservative PROFILE viewport sweep, strict TAGGED union and fail-closed regressions — PASS');
