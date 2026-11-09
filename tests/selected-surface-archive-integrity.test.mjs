import fs from 'node:fs';
import assert from 'node:assert/strict';

// All fixtures are synthetic. No browser, session, network or Instagram account.
const source=fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8'
);
function extract(name) {
    const match=new RegExp('    (?:async )?function '+name+'\\(').exec(source);
    assert.ok(match,'missing production function '+name);
    const end=source.indexOf('\n    }\n',match.index);
    assert.ok(end>match.index,'end of production function '+name);
    return source.slice(match.index,end+7);
}
const normalizePk=x=>String(x?.pk||x?.id||'').split('_')[0];
const mk=(pk,url='',opts={})=>({
    pk,...(url?{url}:{}),...opts,
});
function archive(raw,sourceName,state) {
    const root=raw?.media&&typeof raw.media==='object'?raw.media:raw;
    const children=Array.isArray(root?.carousel_media)&&root.carousel_media.length
        ?root.carousel_media
        :(root?.edge_sidecar_to_children?.edges||[])
            .map(e=>e?.node).filter(Boolean);
    const units=children.length?children:[root];
    for(const unit of units) {
        if(!unit?.url) continue;
        const id=normalizePk(unit);
        const old=state.queue.get(id);
        if(old) {
            old.sources.add(sourceName);
            continue;
        }
        state.queue.set(id,{
            id,url:unit.url,filename:id+'.jpg',
            sources:new Set([sourceName]),rootIds:new Set([normalizePk(root)]),
        });
    }
}
function proofFn(state) {
    return new Function('state','normalizePk',
        extract('discoveredMediaResolution')+
        '\nreturn discoveredMediaResolution;'
    )(state,normalizePk);
}
{
    const state={queue:new Map()},sourceName='TAGGED';
    const resolve=proofFn(state);
    const photo=mk('10','https://example.test/photo.jpg');
    assert.equal(resolve(photo,sourceName).ok,false,'no archive');
    archive(photo,sourceName,state);
    assert.equal(resolve(photo,sourceName).ok,true,'archived root');
    assert.equal(resolve(photo,'STORY_WEB_GRAPHQL').ok,false,
        'same ID cannot imply another source was archived');
    state.queue.get('10').url='';
    assert.equal(resolve(photo,sourceName).ok,false,'URL disappeared');
    state.queue.get('10').diskBacked=true;
    assert.equal(resolve(photo,sourceName).ok,true,'indexed existing file');
    assert.equal(resolve(mk('missing',''),sourceName).ok,false);
    assert.equal(resolve(null,sourceName).ok,false);
}
{
    const state={queue:new Map()},resolve=proofFn(state),tag='HIGHLIGHT_REEL:1';
    const sidecar=mk('300','',{media_type:8,carousel_media:[
        mk('301','https://example.test/301.jpg'),
        mk('302','https://example.test/302.jpg'),
    ],carousel_media_count:2});
    archive(sidecar,tag,state);
    assert.equal(resolve(sidecar,tag).ok,true,'all carousel units resolved');
    assert.equal(resolve({...sidecar,carousel_media_count:3},tag).ok,false,
        'declared item not accounted for');
    assert.equal(resolve({...sidecar,carousel_media:[sidecar.carousel_media[0]]},tag).ok,false,
        'one-child sidecar cannot prove complete carousel');
    assert.equal(resolve({...sidecar,
        edge_sidecar_to_children:{page_info:{has_next_page:true}}},tag).ok,false);
    assert.equal(resolve({...sidecar,carousel_media:[
        sidecar.carousel_media[0],sidecar.carousel_media[0]]},tag).ok,false,
        'duplicate child identity is not an exhaustive archive');
}

// Exercise actual TAGGED scanner: previously page_info_end marked a complete
// scan although two edges yielded zero archived files (observed 2026-11-09).
async function taggedFixture(data,{hasNext=false}={}) {
    const state={
        userId:'123',cancelled:false,
        coverage:{tagged:false},queue:new Map(),
        roots:{TAGGED:new Set()},
    };
    const net={
        taggedDocInitial:null,taggedDocConnection:null,taggedNativeVariables:null,
        taggedInitialData:null,taggedInitialUserId:'',
    };
    const logs=[],calls=[];
    const gql=async(doc,vars,friendly)=>{
        calls.push({doc,vars,friendly});
        return {conn:{edges:data.map(node=>({node})),
            page_info:{has_next_page:hasNext,end_cursor:null}}};
    };
    const scanner=new Function('state','net','APP','gql','taggedConn',
        'edgeNode','addMedia','discoveredMediaResolution','normalizePk',
        'updateStats','log','throwIfInstagramStop','sleep','rand',
        extract('scanTaggedGraphQL')+
        '\nreturn scanTaggedGraphQL;'
    )(state,net,{TAGGED_FALLBACK_DOC:'fixture',TAGGED_MAX_PAGES:5},
        gql,d=>d.conn,e=>e.node,
        (media,_kind,origin)=>archive(media,origin,state),
        proofFn(state),normalizePk,()=>{},
        (...args)=>logs.push(args),()=>{},async()=>{},()=>0);
    return {completed:await scanner(),state,calls,logs};
}
{
    const x=await taggedFixture([mk('1'),mk('2')]);
    assert.equal(x.completed,false,'two thin GraphQL roots have NO media URLs');
    assert.equal(x.state.coverage.tagged,false,'server page end cannot imply file archive');
    assert.equal(x.state.roots.TAGGED.size,2,'all discovered tagged IDs recorded');
    assert.equal(x.state.queue.size,0,'zero queued files is not a success');
    assert.ok(x.logs.some(x=>x[0].includes('unresolved=2')));
    assert.equal(x.calls.length,1,'no speculative follow-up request');
}
{
    const x=await taggedFixture([
        mk('1','https://example.test/1.jpg'),
        mk('2','https://example.test/2.jpg'),
    ]);
    assert.equal(x.completed,true);
    assert.equal(x.state.queue.size,2);
    assert.equal(x.state.roots.TAGGED.size,2);
}
{
    const x=await taggedFixture([]);
    assert.equal(x.completed,true,'explicit empty TAGGED page is complete');
}

// Exercise actual STORY scanner. One item that could not be archived must
// prevent the false coverage:true even when the Web response completed.
async function storyFixture(items) {
    const state={userId:'123',queue:new Map(),coverage:{story:false}};
    const log=[];
    const scanner=new Function(
        'state','fetchWebStoryReel','hiId','addMedia',
        'discoveredMediaResolution','updateStats','log','status','throwIfInstagramStop',
        extract('scanStory')+'\nreturn scanStory;'
    )(state,async()=>[{id:'123',items}],v=>String(v),
        (media,_kind,origin)=>archive(media,origin,state),
        proofFn(state),()=>{},(...args)=>log.push(args),()=>{},()=>{});
    return {completed:await scanner(),state,log};
}
{
    const x=await storyFixture([mk('1'),mk('2','https://example.test/2.jpg')]);
    assert.equal(x.completed,false,'1 of 2 stories unresolved');
    assert.equal(x.state.queue.size,1,'other story remains available');
    assert.ok(x.log.some(x=>x[0].includes('unresolved=1')));
}
{
    const x=await storyFixture([mk('1','https://example.test/1.jpg')]);
    assert.equal(x.completed,true);
}
{
    const x=await storyFixture([]);
    assert.equal(x.completed,true,'known empty Story response');
}

// Exercise actual Highlights scanning with a one-collection mocked tray.
async function highlightFixture(items) {
    const state={queue:new Map(),coverage:{highlights:false},
        cancelled:false,highlightCatalog:new Map()};
    const log=[];
    const scan=new Function(
        'state','getHighlightTrayWeb','highlightTrayConn','edgeNode',
        'buildHighlightCatalog','setScanProgressPhase','updateStats',
        'status','log','throwIfInstagramStop','hiId','fetchWebStoryReel',
        'addMedia','discoveredMediaResolution','sleep','rand','APP',
        'reconcileHighlightTitleHistory','reportHighlightFolderRenames',
        extract('scanHighlights')+'\nreturn scanHighlights;'
    )(state,
        async()=>({data:{conn:{edges:[{node:{id:'1',title:'Collection'}}],
            page_info:{has_next_page:false}}},source:'fixture'}),
        d=>d.conn,e=>e.node,
        tray=>new Map(tray.map(x=>[x.id,{
            id:x.id,title:x.title,folder:'Collection [1]',
        }])),
        ()=>{},()=>{},()=>{},(...args)=>log.push(args),()=>{},
        v=>String(v).replace(/^highlight:/,''),
        async()=>[{id:'highlight:1',items}],
        (media,_kind,origin)=>archive(media,origin,state),
        proofFn(state),async()=>{},()=>0,{PAGE_MIN:1,PAGE_MAX:1},
        ()=>{},()=>{});
    return {completed:await scan(),state,log};
}
{
    const x=await highlightFixture([mk('1'),mk('2','https://example.test/2.jpg')]);
    assert.equal(x.completed,false,'one missing Highlight file voids collection proof');
    assert.equal(x.state.queue.size,1);
    assert.ok(x.log.some(x=>x[0].includes('1/2 returned items')));
}
{
    const x=await highlightFixture([
        mk('1','https://example.test/1.jpg'),mk('2','https://example.test/2.jpg')
    ]);
    assert.equal(x.completed,true);
    assert.equal(x.state.queue.size,2);
}
{
    const x=await highlightFixture([]);
    assert.equal(x.completed,true,'an explicitly empty but finished collection');
}

// Fail closed when public SSR is unavailable: only the target may be
// revisited; never compare with unrelated popular public accounts.
{
    const state={username:'testprofile',userId:'123',profileInfo:{is_private:false},
        shadow:{},coverage:{publicShadow:false}};
    const calls=[];
    const log=[];
    const scanner=new Function('state','fetchAnonymousProfileProbe',
        'feedbackRequiredIn','anonymousProfileRestriction',
        'parseAnonymousProfileHTML','log','status','updateStats',
        'throwIfInstagramStop',
        extract('scanPublicShadow')+'\nreturn scanPublicShadow;'
    )(state,async(username)=>{calls.push(username);
            return {status:200,responseText:'<html>missing SSR</html>'};},
        ()=>false,()=>null,()=>{throw Error('SSR public timeline not found');},
        (...x)=>log.push(x),()=>{},()=>{},()=>{});
    assert.equal(await scanner(),false);
    assert.deepEqual(calls,['testprofile','testprofile'],
        'only target-specific attempts, zero unrelated-account probes');
    assert.equal(state.shadow.applicable,true,
        'missing SSR is UNKNOWN, not a fabricated N/A proof');
    assert.equal(state.coverage.publicShadow,false);
}
assert.ok(!source.includes('probeAnonymousPublicControl'));
assert.ok(!source.includes("const controls = ['instagram', 'natgeo']"));
console.log('Surface integrity and target-only HTTP policy — PASS');
