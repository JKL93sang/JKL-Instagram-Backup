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
    state.queue.get('10').rootIds.clear();
    assert.equal(resolve(photo,sourceName).ok,false,
        'same-source unit missing the current parent root cannot prove archival');
    state.queue.get('10').rootIds.add('10');
    assert.equal(resolve(photo,sourceName).ok,true);
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
    assert.equal(resolve(mk('77','https://example.test/cover.jpg',
        {product_type:'carousel'}),tag).ok,false,
        'carousel product type without child inventory cannot be complete');
    assert.equal(resolve({...sidecar,carousel_media_count:'oops'},tag).ok,false,
        'malformed carousel count is unknown, never a proof');
    assert.equal(resolve({...sidecar,carousel_media_count:1.25},tag).ok,false,
        'fractional count cannot prove completeness');
}

// Exercise actual TAGGED scanner: previously page_info_end marked a complete
// scan although two edges yielded zero archived files (observed 2026-11-09).
async function taggedFixture(data,{hasNext=false,details={}}={}) {
    const state={
        userId:'123',cancelled:false,
        coverage:{tagged:false},queue:new Map(),
        roots:{TAGGED:new Set()},
    };
    const net={
        taggedDocInitial:null,taggedDocConnection:null,taggedNativeVariables:null,
        taggedInitialData:null,taggedInitialUserId:'',
    };
    const logs=[],calls=[],mediaInfoCalls=[];
    const fetchOwnedMediaInfo=async(id,label,policy)=>{
        mediaInfoCalls.push({id,label,policy});
        if (Object.hasOwn(details,id)) return details[id];
        throw Error('synthetic media-info unavailable');
    };
    const gql=async(doc,vars,friendly)=>{
        calls.push({doc,vars,friendly});
        return {conn:{edges:data.map(node=>({node})),
            page_info:{has_next_page:hasNext,end_cursor:null}}};
    };
    const scanner=new Function('state','net','APP','gql','taggedConn',
        'edgeNode','addMedia','discoveredMediaResolution','normalizePk',
        'taggedAccessibleCarouselProof',
        'fetchOwnedMediaInfo','updateStats','log','throwIfInstagramStop','sleep','rand',
        extract('scanTaggedGraphQL')+
        '\nreturn scanTaggedGraphQL;'
    )(state,net,{TAGGED_FALLBACK_DOC:'fixture',TAGGED_MAX_PAGES:5,
        TAGGED_HYDRATION_LIMIT:8},
        gql,d=>d.conn,e=>e.node,
        (media,_kind,origin)=>archive(media,origin,state),
        proofFn(state),normalizePk,
        new Function('normalizePk',extract('taggedAccessibleCarouselProof')+
            '\nreturn taggedAccessibleCarouselProof;')(normalizePk),
        fetchOwnedMediaInfo,()=>{},
        (...args)=>logs.push(args),()=>{},async()=>{},()=>0);
    return {completed:await scanner(),state,calls,logs,mediaInfoCalls};
}
{
    const x=await taggedFixture([mk('1'),mk('2')]);
    assert.equal(x.completed,false,'two thin GraphQL roots have NO media URLs');
    assert.equal(x.state.coverage.tagged,false,'server page end cannot imply file archive');
    assert.equal(x.state.roots.TAGGED.size,2,'all discovered tagged IDs recorded');
    assert.equal(x.state.queue.size,0,'zero queued files is not a success');
    assert.ok(x.logs.some(x=>x[0].includes('unresolved=2')));
    assert.equal(x.calls.length,1,'no additional GraphQL request');
    assert.equal(x.mediaInfoCalls.length,2,
        'one bounded same-origin hydration attempt for each thin tagged root');
    assert.ok(x.mediaInfoCalls.every(c=>c.policy.singleWebOnly===true),
        'no mobile host or retry fallback permitted');
}
{
    const x=await taggedFixture([mk('1'),mk('2')],{details:{
        '1':mk('1','https://cdn.example.test/1.jpg',{media_type:1}),
        '2':mk('2','https://cdn.example.test/2.jpg',{media_type:1}),
    }});
    assert.equal(x.completed,true,'thin TAGGED discovery must hydrate full URLs');
    assert.equal(x.state.queue.size,2);
    assert.equal(x.mediaInfoCalls.length,2);
    assert.ok(x.logs.some(x=>x[0].includes('hydration=2/2')));
}
{
    const x=await taggedFixture([
        mk('91','',{media_type:2,display_uri:'https://cdn.example.test/cover.jpg'}),
    ],{details:{'91':mk('91','',{media_type:2,
        video_versions:[{url:'https://cdn.example.test/real.mp4'}],
        url:'https://cdn.example.test/real.mp4'})}});
    assert.equal(x.completed,true,'poster-only tagged video is hydrated to MP4');
    assert.equal(x.mediaInfoCalls.length,1);
}
{
    const x=await taggedFixture([mk('44')],{details:{
        '44':mk('45','https://cdn.example.test/wrong.jpg'),
    }});
    assert.equal(x.completed,false,'wrong identity is never archived as tagged');
    assert.equal(x.state.queue.size,0);
    assert.ok(x.logs.some(x=>x[0].includes('media_info_identity_mismatch')));
}
{
    const x=await taggedFixture(Array.from({length:10},
        (_,i)=>mk(String(100+i))),{details:Object.fromEntries(
        Array.from({length:10},(_,i)=>[
            String(100+i),mk(String(100+i),'https://cdn.example.test/'+i+'.jpg')
        ])
    )});
    assert.equal(x.completed,false,'bounded hydration does not claim complete');
    assert.equal(x.mediaInfoCalls.length,8,'maximum eight hydrated roots');
    assert.equal(x.state.queue.size,8);
    assert.ok(x.logs.some(x=>x[0].includes('hydration_limit_reached')));
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

// Production media-info helper must execute only ONE request on the browser
// origin when invoked for TAGGED, and may not silently try i.instagram.com.
{
    const requests=[];
    const info=new Function('state','APP','gmRequest',
        'feedbackRequiredIn','feedbackCircuitBreak',
        'throwIfInstagramStop','apiUnhealthyError','rateLimitCircuitBreak',
        'sleep','rand',
        extract('fetchOwnedMediaInfo')+'\nreturn fetchOwnedMediaInfo;'
    )({cancelled:false},{HYDRATE_RETRIES:3,APP_ID:'test',MOBILE_UA:'test'},
        async args=>{
            requests.push(args);
            return {status:200,responseText:JSON.stringify({
                status:'ok',items:[{pk:'889',media_type:1,
                    image_versions2:{candidates:[{url:'https://cdn.example.test/889.jpg'}]}}],
            })};
        },
        ()=>false,()=>{throw Error('feedback')},()=>{},
        m=>new Error(m),m=>new Error(m),async()=>{},()=>0);
    const media=await info('889','TAGGED test',{singleWebOnly:true});
    assert.equal(media.pk,'889');
    assert.equal(requests.length,1);
    assert.ok(requests[0].url.startsWith('https://www.instagram.com/'));
    assert.ok(!requests[0].url.includes('clips/user'));
}

// Regression: TAGGED XDTMediaDict image fields must enter the real downloader
// via addMedia. A video cover is NOT a downloadable MP4.
{
    const state={queue:new Map(),diskActive:false};
    const rootKind=new Function(extract('rootKind')+'\nreturn rootKind;')();
    const bestImage=new Function(extract('bestImage')+'\nreturn bestImage;')();
    const bestVideo=new Function(extract('bestVideo')+'\nreturn bestVideo;')();
    const isVideo=new Function(extract('isVideo')+'\nreturn isVideo;')();
    const addMedia=new Function(
        'state','rootKind','authenticatedMediaVisibility',
        'scanSelected','normalizePk','shortcodeId',
        'registerOwnedRootMembership','isVideo','bestVideo',
        'bestImage','originalToken','filename','PRIORITY','registerOwnedRoot',
        extract('addMedia')+'\nreturn addMedia;'
    )(state,rootKind,()=>'',()=>true,normalizePk,()=>'',()=>{},
        isVideo,bestVideo,bestImage,()=>'',m=>m.id+'.jpg',{},()=>{});
    const photo={
        pk:'3101',media_type:1,code:'abc',
        display_uri:'https://cdn.example.test/full-display.jpg',
    };
    assert.equal(addMedia(photo,'TAGGED','TAGGED'),1,
        'XDT display_uri should produce one real tagged archive entry');
    assert.equal(state.queue.get('3101').url,photo.display_uri);
    assert.equal(proofFn(state)(photo,'TAGGED').ok,true,
        'actual TAGGED media is resolved by the production proof gate');

    const invalidCandidates={
        pk:'3102',media_type:1,
        image_versions2:{candidates:[{width:1080,height:1080}]},
        display_uri:'https://cdn.example.test/fallback-display.jpg',
    };
    assert.equal(addMedia(invalidCandidates,'TAGGED','TAGGED'),1,
        'malformed image candidates must not suppress a valid display_uri');

    const videoPosterOnly={
        pk:'3103',media_type:2,
        display_uri:'https://cdn.example.test/video-cover.jpg',
    };
    assert.equal(addMedia(videoPosterOnly,'TAGGED','TAGGED'),0,
        'video cover must NEVER be archived as the video file');
    assert.equal(proofFn(state)(videoPosterOnly,'TAGGED').ok,false);
    const thumbnailOnly={
        pk:'3104',media_type:1,
        thumbnail_url:'https://cdn.example.test/small-preview.jpg',
    };
    assert.equal(addMedia(thumbnailOnly,'TAGGED','TAGGED'),0,
        'TAGGED must not mark thumbnail-only content as archived');
    assert.equal(proofFn(state)(thumbnailOnly,'TAGGED').ok,false);
}

// Regression: browser TAGGED responses are captured by the REQUEST's verified
// numeric ID before the userscript resolves its scan profile. They survive
// exactly one matching scan for at most 20 seconds, without any extra network.
{
    const TAGGED_CONNECTION_KEY=
        'xdt_api__v1__usertags__user_id__feed_connection';
    const net={
        taggedNativeByUserId:new Map(),
        taggedBootstrapConsumedByUserId:new Set(),
        taggedDocInitial:'',taggedDocConnection:'',
        taggedNativeVariables:null,taggedInitialData:null,
        taggedInitialUserId:'',
    };
    const keyedConnection=new Function(extract('keyedConnection')+
        '\nreturn keyedConnection;')();
    const taggedConn=new Function('keyedConnection','TAGGED_CONNECTION_KEY',
        extract('taggedConn')+'\nreturn taggedConn;'
    )(keyedConnection,TAGGED_CONNECTION_KEY);
    const captureTagged=new Function(
        'net','keyedConnection','TAGGED_CONNECTION_KEY',
        extract('captureTagged')+'\nreturn captureTagged;'
    )(net,keyedConnection,TAGGED_CONNECTION_KEY);
    const prepare=new Function('net','APP','taggedConn',
        extract('prepareTaggedNativeEvidenceForScan')+
        '\nreturn prepareTaggedNativeEvidenceForScan;'
    )(net,{PROFILE_BOOTSTRAP_MAX_AGE_MS:20000},taggedConn);
    const uid='45790055326',now=5000000;
    const native={
        data:{[TAGGED_CONNECTION_KEY]:{
            edges:[{node:{pk:'3101',media_type:1,
                display_uri:'https://cdn.example.test/3101.jpg'}}],
            page_info:{has_next_page:false,end_cursor:null},
        }},
    };
    const meta={
        friendly:'PolarisProfileTaggedTabContentQuery',
        docId:'28390247837269928',
        variables:{user_id:uid,count:12,after:null},
    };
    assert.equal(captureTagged(native,meta,now),true,
        'native response can be captured even before scan userId exists');
    assert.equal(prepare('some_other_user',now+1).retained,false,
        'another target must not gain these TAGGED roots');
    const retained=prepare(uid,now+1000);
    assert.equal(retained.retained,true);
    assert.equal(retained.roots,1);
    assert.equal(net.taggedInitialData,native);
    assert.equal(net.taggedInitialUserId,uid);
    assert.equal(net.taggedDocInitial,meta.docId);
    assert.equal(prepare(uid,now+1001).retained,false,
        'captured first page is single use');
    assert.equal(captureTagged(native,meta,now+2000),true,
        'a genuinely new native response replaces the consumed snapshot');
    assert.equal(prepare(uid,now+22001).retained,false,
        'expired native observations cannot be reused');
    assert.equal(captureTagged(native,{...meta,variables:{
        user_id:uid,after:'continuation-cursor'
    }},now+3000),false,'continuation is not a first page');
    assert.equal(captureTagged({data:{other:{
        edges:[{node:{pk:'1'}}],page_info:{has_next_page:false}
    }}},meta,now+3000),false,
        'unrelated GraphQL connection is not TAGGED proof');
    assert.equal(taggedConn({data:{unrelated:{
        edges:[{node:{pk:'1'}}],page_info:{has_next_page:false}
    }}}),null);
    assert.equal(captureTagged({...native,errors:[{message:'fail'}]},
        meta,now+4000),false,'GraphQL partial errors cannot validate TAGGED');
}

{
    const start=source.indexOf('    async function scanAll()');
    const scan=source.slice(start,source.indexOf('    function ',start+10));
    assert.ok(scan.includes('prepareTaggedNativeEvidenceForScan('),
        'scanAll must consume native TAGGED evidence');
    assert.ok(scan.indexOf('net.taggedInitialData = null;') <
        scan.indexOf('prepareTaggedNativeEvidenceForScan('),
        'TAGGED first page is restored after the per-scan reset');
}

console.log('Surface integrity and target-only HTTP policy — PASS');
