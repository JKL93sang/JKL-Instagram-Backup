import fs from 'node:fs';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name){
 const m=new RegExp('    (?:async )?function '+name+'\\(').exec(src);
 assert.ok(m,'missing production '+name);
 const end=src.indexOf('\n    }\n',m.index);
 assert.ok(end>m.index,'missing end '+name);
 return src.slice(m.index,end+7);
}
function harness(opts={}){
 const uid='57732395174',user='aphrodixiaa',pubIds=Array.from({length:32},(_,i)=>String(1000+i));
 const state={
  username:user,userId:uid,expected:34,cancelled:false,
  profileInfo:{pk:opts.foreign?'999':uid,is_private:false},
  shadow:{applicable:true,pageInfoEnded:true,profileId:uid,rootIds:new Set(pubIds)},
  coverage:{publicShadow:true},roots:{POST:new Set([...pubIds,'8000']),REEL:new Set()},
 };
 const nativeIds=[...pubIds.slice(0,11),'8000'];
 const nativeMap=new Map(nativeIds.map(id=>[id,{pk:id,media_type:1}]));
 const capturedAt=Date.now()-(opts.stale?30000:500);
 const net={
  gridNativeInitialByUser:new Map(),
  gridNativeContinuationByUser:new Map(),gridNativeAuditByUser:new Map(),
  gridPageInfo:new Map(),gridByUser:new Map(),gridDocByUser:new Map(),
  gridCaptureSeenAtByUser:new Map(),
 };
 const contract={docId:'123456789',friendly:'PolarisProfilePostsTabContentQuery',
  endpoint:'api',timelineKeyVerified:!opts.noExactKey,
  variables:{username:user,after:'previous-real-cursor',first:12},
  template:{headers:{'x-root-field-name':'xdt_api__v1__feed__user_timeline_graphql_connection'},body:{}},
 };
 net.gridNativeContinuationByUser.set(user,contract);
 if(opts.initialCaptured) net.gridNativeInitialByUser.set(user,{
  ...contract,docId:'77777777',
  variables:{username:user,first:12},
 });
 net.gridNativeAuditByUser.set(user,{
  initial:opts.initialCaptured?1:0,continuation:1,
  cursorLocation:'root',lastHasNext:'true',
 });
 net.gridPageInfo.set(user,{has_next_page:true,end_cursor:opts.cursorMissing?'':'real-next-cursor'});
 net.gridByUser.set(user,nativeMap);
 net.gridDocByUser.set(user,contract.docId);
 net.gridCaptureSeenAtByUser.set(user,capturedAt);
 const calls=[],logs=[];
 const ret=new Function('state','net','APP','GRID_NAMES','GRID_CONNECTION_KEY',
  'requestTargetsCurrentProfile','webRelayGql','gridConn','keyedConnection',
  'ownedCount','addMedia','edgeNode','normalizePk','updateStats','log',
  'sleep','rand','throwIfInstagramStop',
  [
   extract('profileNativeCompletionRequest'),
   extract('profileCompletionVariables'),
   extract('scanProfileGraphQLFallback'),
  ].join('\n')+'\nreturn {profileNativeCompletionRequest,scanProfileGraphQLFallback};'
 )(state,net,{PROFILE_BOOTSTRAP_MAX_AGE_MS:20000,PROFILE_MAX_SCROLLS:5,PAGE_MIN:0,PAGE_MAX:0},
  new Set(['PolarisProfilePostsTabContentQuery']),
  'xdt_api__v1__feed__user_timeline_graphql_connection',
  meta=>meta.variables.username===user,
  async (doc,vars,friendly,options)=>{
   calls.push({doc,vars,friendly,options});
   const id=(opts.missing||opts.stagnant)?'1000':'8001';
   const hasNext=opts.stagnant?true:(opts.hasNext??false);
   const connection={edges:[{node:{pk:id,media_type:1}}],
    page_info:{has_next_page:hasNext,
      end_cursor:opts.stagnant?'next-'+calls.length:hasNext?'repeat':''}};
   return opts.wrongConnection?
    {data:{some_unrelated_connection:connection}}:
    {data:{xdt_api__v1__feed__user_timeline_graphql_connection:connection}};
  },
  d=>d?.data?.xdt_api__v1__feed__user_timeline_graphql_connection,
  (d,key)=>d?.data?.[key],
  ()=>new Set([...state.roots.POST,...state.roots.REEL]).size,
  (node,type,origin)=>state.roots.POST.add(String(node.pk)),
  e=>e.node,
  n=>String(n?.pk||'').split('_')[0],
  ()=>{},(...a)=>logs.push(a),async()=>{},()=>0,
  e=>{if(e?.code?.startsWith('IG_'))throw e;},
 );
 return {state,net,calls,logs,...ret};
}
{
 const x=harness();
 const c=x.profileNativeCompletionRequest('aphrodixiaa');
 assert.equal(c?.mode,'observed_tail');
 assert.equal(c?.startCursor,'real-next-cursor');
 const done=await x.scanProfileGraphQLFallback();
 assert.equal(done.ended,true,'authenticated tail and public union=34/34 must complete');
 assert.equal(done.pages,1);
 assert.equal(x.calls.length,1,'reuse exactly one observed native cursor');
 assert.equal(x.calls[0].vars.after,'real-next-cursor');
 assert.equal(x.state.roots.POST.size,34);
 assert.equal(x.net.gridByUser.get('aphrodixiaa').has('8001'),true);
 assert.equal(done.endReason,'native_resume_page_info_end_exact_union');
}
// A live v1.5.89 incident: initial+continuation both exist, but
// replaying from page 1 duplicated 12+12 edges before a third
// GraphQL server_execution error. Resume at the last native cursor.
{
 const x=harness({initialCaptured:true});
 const c=x.profileNativeCompletionRequest('aphrodixiaa');
 assert.equal(c?.mode,'native_resume');
 assert.equal(c.initial?.docId,'77777777');
 assert.equal(c.startCursor,'real-next-cursor');
 const done=await x.scanProfileGraphQLFallback();
 assert.equal(done.ended,true);
 assert.equal(done.pages,1,'native resumption must not reread two earlier pages');
 assert.equal(x.calls.length,1);
 assert.equal(x.calls[0].doc,'123456789');
 assert.equal(x.calls[0].vars.after,'real-next-cursor');
 assert.equal(done.endReason,'native_resume_page_info_end_exact_union');
 assert.ok(x.logs.some(x=>x[0].includes('mode=native_resume')));
}
// Identical native continuation pages must never lead to a third
// speculative query (v1.5.89 observed 2x12 known roots then server_execution).
{
 const x=harness({initialCaptured:true,stagnant:true});
 const result=await x.scanProfileGraphQLFallback();
 assert.equal(result.ended,false);
 assert.equal(result.pages,2);
 assert.equal(x.calls.length,2,'no third repeated query');
 assert.equal(result.endReason,'native_resume_stalled_without_server_end');
 assert.ok(x.logs.some(entry=>String(entry[0]).includes('no-progress pages')));
}
for(const [name,opts] of [
 ['wrong profile identity',{foreign:true}],
 ['stale native response',{stale:true}],
 ['unverified native connection',{noExactKey:true}],
 ['missing server cursor',{cursorMissing:true}],
]){
 const x=harness(opts);
 assert.equal(x.profileNativeCompletionRequest('aphrodixiaa'),null,name);
 const r=await x.scanProfileGraphQLFallback();
 assert.equal(r.ended,false,name);
 assert.equal(x.calls.length,0,'no speculative network '+name);
}
for(const [name,opts,reason] of [
 ['server-ended but incomplete union',{missing:true},'native_resume_union_counter_unverified'],
 ['wrong returned connection',{wrongConnection:true},'connection_missing'],
]){
 const x=harness(opts);
 const r=await x.scanProfileGraphQLFallback();
 assert.equal(r.ended,false,name);
 assert.equal(r.endReason,reason);
 assert.equal(x.calls.length,1,'only captured/verified cursor sent '+name);
}
console.log('PROFILE native-tail resume: 32/34 + 12 native + 1 page, identity, TTL, connection and union guards — PASS.');
