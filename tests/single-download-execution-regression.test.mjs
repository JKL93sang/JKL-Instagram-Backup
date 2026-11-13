import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const m=new RegExp('    (?:async )?function '+name+'\\(').exec(source);
    assert.ok(m,'production function missing: '+name);
    const end=source.indexOf('\n    }\n',m.index);
    assert.ok(end>m.index,'production function incomplete: '+name);
    return source.slice(m.index,end+7);
}

const uid='57732395174',rootId='990001',user='aphrodixiaa';
const createCarousel=()=>({
    pk:rootId,media_type:8,carousel_media_count:3,
    user:{username:user},taken_at:1794350000,
    carousel_media:[
        {pk:'990002',url:'https://cdn.example/a.jpg'},
        {pk:'990003',url:'https://cdn.example/b.jpg'},
        {pk:'990004',url:'https://cdn.example/c.jpg'},
    ],
});
const standaloneMethods=[
    'normalizePk','standaloneFilename','standaloneUnits'
].map(extract).join('\n');
const state={username:user,running:false,downloading:false,cancelled:false,
    feedbackRequired:false,rateLimited:false,apiUnhealthy:false};
const statuses=[],logs=[],requested=[];
const singleDownloadState={busy:new Set()};
const APP={DOWNLOAD_DELAY:0};
const helper=new Function(
    'state','cleanUser','rootKind','currentProfile','isVideo','bestImage',
    'bestVideo','sanitize','datePart','normalizePkUnused',
    standaloneMethods+'\nreturn standaloneUnits;'
)(
    state,s=>String(s||'').replace(/[^A-Za-z0-9._]/g,''),
    (_raw,forced)=>forced||'POST',()=>user,
    raw=>raw.isVideo===true,raw=>raw.url||'',raw=>raw.url||'',
    x=>String(x),()=> '2026_11_11',()=>{},
);

{
    const files=helper(createCarousel(),'POST',rootId);
    assert.equal(files.length,3);
    assert.deepEqual(files.map(x=>x.id),['990002','990003','990004']);
    assert.ok(files.every(x=>x.username===user));
    assert.ok(files.every(x=>x.filename.includes('POST')));
}
{
    const x=createCarousel();
    x.carousel_media.pop();
    assert.throws(()=>helper(x,'POST',rootId),/carousel structure is incomplete/);
}
{
    const x=createCarousel();
    x.carousel_media[2].url='';
    assert.throws(()=>helper(x,'POST',rootId),/media URL unavailable/);
}
{
    const x=createCarousel();
    x.carousel_media[2].pk=x.carousel_media[1].pk;
    assert.throws(()=>helper(x,'POST',rootId),/duplicated carousel/);
}
{
    const x=createCarousel();
    x.carousel_media_count=4;
    assert.throws(()=>helper(x,'POST',rootId),/carousel structure is incomplete/);
}
{
    const x=createCarousel();
    x.edge_sidecar_to_children={page_info:{has_next_page:true}};
    assert.throws(()=>helper(x,'POST',rootId),/carousel structure is incomplete/);
}
{
    const x=createCarousel();
    x.pk='unrelated';
    assert.throws(()=>helper(x,'POST',rootId),/root identity does not match/);
}
{
    const x=createCarousel();
    x.media_type=8;x.carousel_media=[];x.carousel_media_count=0;
    assert.throws(()=>helper(x,'POST',rootId),/carousel structure is incomplete/);
}
{
    const x={pk:rootId,media_type:1,user:{username:user},url:'https://cdn.example/image.jpg'};
    assert.equal(helper(x,'POST',rootId).length,1);
}

// Test the real GM_download dispatch (with no network).
{
    const attempt=extract('downloadStandaloneAttempt');
    const writes=[];
    const dispatch=new Function('GM_download','archiveDownloadPath',
        attempt+'\nreturn downloadStandaloneAttempt;'
    )(
        opts=>{writes.push(opts);opts.onload();},
        (m,username)=>username+'/'+username+' - POSTS/'+m.filename,
    );
    const file=helper(createCarousel(),'POST',rootId)[0];
    await dispatch(file);
    assert.equal(writes.length,1);
    assert.equal(writes[0].name,user+'/'+user+' - POSTS/'+file.filename);
    assert.equal(writes[0].saveAs,false);
    assert.equal(writes[0].conflictAction,'overwrite');
}

const actualDownload=extract('downloadSingleTarget');
const actualClick=extract('handleSingleDownloadClick');
const actualFindButton=extract('singleDownloadButtonFromEvent');
assert.match(actualDownload,/standaloneUnits\(\s*item,\s*forcedType,\s*actualId\s*\)/,
    'Single pipeline MUST pass the verified resolved root identity into all-or-nothing unit planner');
assert.match(actualDownload,/const actualId\s*=\s*resolved.kind\s*===\s*'story-viewer'/,
    'The username-only Story viewer must use authenticated item identity, not a guessed root ID');
const executer=new Function(
    'state','singleDownloadState','status','log','fetchStandaloneMediaInfo',
    'standaloneUnits','downloadStandaloneFile','sleep','APP','setTimeout',
    actualDownload+'\nreturn downloadSingleTarget;'
)(
    state,singleDownloadState,(msg,level)=>statuses.push([msg,level]),
    (msg,level)=>logs.push([msg,level]),
    async id=>{assert.equal(id,rootId);return createCarousel();},
    helper,
    async file=>{
        assert.equal(state.downloading,true,
            'single transfer must hold global operation mutex');
        requested.push(file.id);
    },
    async()=>{},APP,()=>{},
);
const target={kind:'media',route:'p',mediaId:rootId,shortcode:'demo',key:'media:'+rootId};
await executer(target);
assert.deepEqual(requested,['990002','990003','990004']);
assert.ok(statuses.some(([x,level])=>x.includes('3 fichier(s)')&&level==='ok'));
assert.equal(singleDownloadState.busy.size,0);
assert.equal(state.downloading,false,
    'single transfer must release global operation mutex on success');

// A missing child URL MUST block before any GM_download request starts.
requested.length=0;
const broken=new Function(
    'state','singleDownloadState','status','log','fetchStandaloneMediaInfo',
    'standaloneUnits','downloadStandaloneFile','sleep','APP','setTimeout',
    actualDownload+'\nreturn downloadSingleTarget;'
)(
    state,singleDownloadState,(msg,level)=>statuses.push([msg,level]),
    (msg,level)=>logs.push([msg,level]),
    async()=>{const r=createCarousel();r.carousel_media[2].url='';return r;},
    helper,async file=>{requested.push(file.id);},async()=>{},APP,()=>{},
);
await broken(target);
assert.equal(requested.length,0,'no partial writes on incomplete carousel');
assert.equal(state.downloading,false,
    'failed media validation must release global operation mutex');
assert.ok(logs.some(([x])=>x.includes('Single download failed')));
state.downloading=true;
await executer(target);
assert.equal(requested.length,0,'no concurrent single transfer during a bulk download');
state.downloading=false;

// Verify window-capture click routing is not merely a string presence check.
const button={dataset:{targetKind:'media',mediaId:rootId,route:'p',shortcode:'demo'},disabled:false};
const eventCalls=[];
const event={
    target:{closest:()=>button},
    preventDefault:()=>eventCalls.push('preventDefault'),
    stopPropagation:()=>eventCalls.push('stopPropagation'),
    stopImmediatePropagation:()=>eventCalls.push('stopImmediatePropagation')
};
const clickHandler=new Function('singleDownloadButtonFromEvent','singleDownloadTargetFromButton',
    'downloadSingleTarget','status','log',
    actualClick+'\nreturn handleSingleDownloadClick;'
)(
    new Function(actualFindButton+'\nreturn singleDownloadButtonFromEvent;')(),
    b=>target,
    t=>{eventCalls.push('download:'+t.mediaId);},
    ()=>{},()=>{}
);
clickHandler(event);
assert.deepEqual(eventCalls,[
    'preventDefault','stopPropagation','stopImmediatePropagation',
    'download:'+rootId
]);
console.log('Standalone click-to-download pipeline and complete carousel identity safeguards passed.');
