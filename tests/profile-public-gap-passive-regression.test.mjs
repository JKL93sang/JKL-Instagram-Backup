import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const m=new RegExp('    (?:async )?function '+name+'\\(').exec(src);
    assert.ok(m,'missing production '+name);
    const end=src.indexOf('\n    }\n',m.index);
    assert.ok(end>m.index,'unterminated production '+name);
    return src.slice(m.index,end+7);
}

const selection=extract('profilePublicGapAvoidsSyntheticRelay');
const completionRequirement=extract('profileCompletionRequirement');
const verifiedNativeTerminal=extract('profileNativeTerminalCounterGapProof');
const scroll=extract('profileScrollTarget');
const grid=extract('scanMainGrid');
assert.ok(grid.includes('if (profilePublicGapAvoidsSyntheticRelay())'),
    'The actual PROFILE scanner must call the passive safety guard');
assert.ok(grid.indexOf('if (profilePublicGapAvoidsSyntheticRelay())') <
          grid.indexOf('await scanProfileGraphQLFallback('),
    'Refusal must occur BEFORE any synthetic continuation dispatch');

const user='aphrodixiaa', uid='57732395174';
const publicIds=Array.from({length:32},(_,i)=>String(1000+i));
const nativeIds=[...publicIds.slice(0,22),'9000','9001'];
function fixture(overrides={}) {
    const state={
        username:user,userId:uid,expected:34,cancelled:false,
        profileInfo:{pk:uid,is_private:false},
        shadow:{applicable:true,pageInfoEnded:true,profileId:uid,
            rootIds:new Set(publicIds)},
        coverage:{publicShadow:true,profileGrid:false},
        roots:{POST:new Set([...publicIds.slice(0,31),'9000']),
            REEL:new Set(['9001','9002','9003'])},
    };
    // The genuine example is 31 POST + 3 REEL with 34 distinct roots.
    const postIds=Array.from({length:31},(_,i)=>String(1000+i));
    state.roots.POST=new Set(postIds);
    state.roots.REEL=new Set(['9000','9001','9002']);
    Object.assign(state,overrides);
    const net={
        gridByUser:new Map([[user,new Map(nativeIds.map(id=>[id,{pk:id}]))]]),
        gridPageInfo:new Map([[user,{has_next_page:true,end_cursor:'observed'}]]),
    };
    const logs=[],dispatched=[];
    const scan=new Function(
        'state','net','APP','location','window','document',
        'log','status','go','pathNorm','primeProfileGridNativeCapture',
        'sleep','profileLinks','updateStats','addMedia','ownedCount',
        'currentProfileGridProgress','waitForProfileGridProgress',
        'ownedIds','hydratePermalinkRoots','restore',
        'scanProfileGraphQLFallback','requestTargetsCurrentProfile',
        selection+'\n'+completionRequirement+'\n'+verifiedNativeTerminal+'\n'+scroll+'\n'+grid+
        '\nreturn {profilePublicGapAvoidsSyntheticRelay,scanMainGrid};'
    )(
        state,net,{PROFILE_MAX_SCROLLS:6},
        {pathname:'/aphrodixiaa/'},
        {scrollY:0,innerHeight:1000,scrollTo(){}},
        {body:{scrollHeight:1000},documentElement:{scrollHeight:1000}},
        (msg,level)=>logs.push([String(msg),level]),()=>{},
        async()=>({ok:true,navigated:false}),
        p=>String(p).replace(/\/+$/,''),
        async()=>({captured:true,method:'already-fresh',roots:24}),
        async()=>{},
        ()=>new Map(),()=>{},
        n=>state.roots.POST.add(String(n.pk)),
        ()=>new Set([...state.roots.POST,...state.roots.REEL]).size,
        ()=>({network:24,height:1000}),
        async()=>false,
        ()=>new Set([...state.roots.POST,...state.roots.REEL]),
        async()=>{throw Error('DOM hydration not expected')},
        async()=>{},
        async()=>{dispatched.push('script-relay');return {ended:false}},
        ({variables})=>variables?.username===user,
    );
    return {state,net,logs,dispatched,...scan};
}

{
    const x=fixture();
    assert.equal(x.profilePublicGapAvoidsSyntheticRelay(),true);
    assert.equal(new Set([...x.state.roots.POST,...x.state.roots.REEL]).size,34);
    const result=await x.scanMainGrid();
    assert.equal(result,false,'34 observed roots are NOT a pagination-end proof');
    assert.equal(x.state.coverage.profileGrid,false);
    assert.deepEqual(x.dispatched,[],
        'No reconstructed API Relay query after verified PUBLIC 32/34 end');
    assert.ok(x.logs.some(([line])=>line.includes(
        'PROFILE native Relay replay skipped: verified PUBLIC source ended at 32/34'
    )));
    assert.ok(x.logs.some(([line])=>line.includes(
        'Main PROFILE grid:'
    )), 'The scanner continues normally after refusing replay');
}
for(const [label,mutate] of [
    ['wrong profile API ID',s=>{s.profileInfo.pk='other';}],
    ['wrong PUBLIC profile ID',s=>{s.shadow.profileId='other';}],
    ['PUBLIC did not finish',s=>{s.shadow.pageInfoEnded=false;}],
    ['PUBLIC not verified',s=>{s.coverage.publicShadow=false;}],
    ['private profile',s=>{s.profileInfo.is_private=true;}],
    ['not applicable',s=>{s.shadow.applicable=false;}],
    ['PUBLIC reaches all expected roots',s=>{s.shadow.rootIds.add('100000');s.expected=33;}],
    ['PUBLIC has zero roots',s=>{s.shadow.rootIds.clear();}],
    ['invalid counter',s=>{s.expected=NaN;}],
]) {
    const x=fixture();
    mutate(x.state);
    assert.equal(x.profilePublicGapAvoidsSyntheticRelay(),false,label);
}
// Refusal of synthetic Relay does not change handling of genuinely
// unrelated/public-unverified cases; existing safe contract checks apply.
{
    const x=fixture();
    x.state.coverage.publicShadow=false;
    const result=await x.scanMainGrid();
    assert.equal(result,false);
    assert.equal(x.dispatched.length,1,
        'Other PROFILE configurations keep the old strict Relay decision');
    assert.equal(x.state.coverage.profileGrid,false);
}
console.log('PROFILE passive public-gap (real 34/34, no server end) regression tests passed.');
