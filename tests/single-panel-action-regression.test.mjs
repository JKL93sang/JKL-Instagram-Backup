import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const p=source.search(new RegExp('    (?:async )?function '+name+'\\('));
    assert.ok(p>=0,'missing production function '+name);
    const end=source.indexOf('\n    }\n',p);
    assert.ok(end>p,'unclosed function '+name);
    return source.slice(p,end+7);
}
const numeric='3797523949836352612';
const target={kind:'media',route:'reel',username:'petit._tigre',
    mediaId:numeric,shortcode:'DSzg-mICLxk',key:'media:'+numeric};
let currentlyOpened=target;
const button={disabled:true,innerHTML:'DOWNLOAD OPEN MEDIA (SOLO)',
    isConnected:false,
    classList:{add(){},remove(){},contains(){return false;}}};
const ui={singleCurrent:button,singleTarget:{textContent:''}};
const state={running:false,downloading:false,feedbackRequired:false,
    rateLimited:false,apiUnhealthy:false};
const singleDownloadState={busy:new Set(),lastOverlayDiagnostic:''};
const logs=[],statuses=[],downloaded=[],apiRequests=[];
const APP={DOWNLOAD_DELAY:0};
const callbacks=[];
const f=new Function('ui','state','currentSingleDownloadTarget',
    'log','status','singleDownloadState','fetchStandaloneMediaInfo',
    'standaloneUnits','downloadStandaloneFile','sleep','APP','setTimeout',
    [
        'updateSingleDownloadPanel',
        'handlePanelSingleDownload',
        'downloadSingleTarget',
    ].map(extract).join('\n')+
    '\nreturn {updateSingleDownloadPanel,handlePanelSingleDownload};'
)(
    ui,state,()=>currentlyOpened,
    (line,level)=>logs.push([line,level]),
    (line,level)=>statuses.push([line,level]),
    singleDownloadState,
    async (id,label)=>{
        apiRequests.push([id,label]);
        assert.equal(id,numeric);
        return {pk:id,media_type:2,url:'https://cdn.example/real.mp4'};
    },
    (item,type,identity)=>{
        assert.equal(identity,numeric);
        assert.equal(type,'REEL');
        return [{id:numeric,url:item.url,username:'petit._tigre'}];
    },
    async file=>{
        assert.equal(state.downloading,true,'common mutex required');
        downloaded.push(file.id);
    },
    async()=>{},APP,callback=>{callbacks.push(callback);}
);
f.updateSingleDownloadPanel();
assert.equal(button.disabled,false,
    'real opened Reel enables permanent solo button without DOM media');
assert.match(ui.singleTarget.textContent,/@petit\._tigre/);
assert.match(ui.singleTarget.textContent,/DSzg-mICLxk/);
assert.match(ui.singleTarget.textContent,/REEL/);

// User click: execute the actual panel handler and actual single-transfer
// controller with fake media-info; no Instagram traffic and no disk writes.
f.handlePanelSingleDownload();
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(apiRequests.map(x=>x[0]),[numeric]);
assert.deepEqual(downloaded,[numeric]);
assert.ok(logs.some(([x])=>x.startsWith('Single download panel click:')));
assert.ok(logs.some(([x])=>x.includes('Single download requested:')));
assert.ok(logs.some(([x])=>x.includes('Single download:')));
assert.ok(statuses.some(([x,level])=>level==='ok'&&x.includes('1 fichier(s)')));
assert.equal(state.downloading,false);
assert.equal(singleDownloadState.busy.size,0);

// A protected/ongoing scan must disable the panel action and not dispatch
// media-info when the controller receives a defensive programmatic call.
state.running=true;
f.updateSingleDownloadPanel();
assert.equal(button.disabled,true);
const requestsBefore=apiRequests.length;
f.handlePanelSingleDownload();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(apiRequests.length,requestsBefore);
state.running=false;

state.feedbackRequired=true;
f.updateSingleDownloadPanel();
assert.equal(button.disabled,true);
assert.match(ui.singleTarget.textContent,/Session Instagram bloquée/);
state.feedbackRequired=false;

// No current opened media: the action disables and clicking never contacts
// Instagram, even when the panel is visible on a profile's grid page.
currentlyOpened=null;
f.updateSingleDownloadPanel();
assert.equal(button.disabled,true);
assert.match(ui.singleTarget.textContent,/Ouvre un POST/);
f.handlePanelSingleDownload();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(apiRequests.length,requestsBefore);
assert.ok(logs.some(([x])=>x.includes('no opened-media permalink')));

// The floating button is allowed to be absent on an age gate. That must be
// explained only once, never loop by mutating DOM on every observer cycle.
let removed=0,overlayTarget=target;
const priorLogs=logs.length;
const overlayState={lastOverlayDiagnostic:''};
const fallback=new Function(
    'currentSingleDownloadTarget','document','currentMediaRoot',
    'largestCurrentMedia','currentMediaOverlayHost',
    'singleDownloadState','log','ensureCurrentDownloadButton',
    'applySingleDownloadTarget','placeCurrentDownloadButton',
    extract('refreshCurrentDownloadButton')+
    '\nreturn refreshCurrentDownloadButton;'
)(
    ()=>overlayTarget,
    {getElementById:()=>({remove(){removed++;}})},
    ()=>({}),
    ()=>null,
    ()=>null,
    overlayState,
    (line,level)=>logs.push([line,level]),
    ()=>{throw Error('should never construct floating button without media');},
    ()=>{},()=>{}
);
fallback();fallback();
assert.equal(removed,2);
assert.equal(logs.length,priorLogs+1,'overlay suppression logs only once');
assert.match(logs.at(-1)[0],/no safe visible region/);
assert.match(logs.at(-1)[0],/floating button unavailable/);

// Assert the persistent action is wired in the real HTML + click hookup.
assert.match(source,/id="jkl-single-current"/);
assert.match(source,/id="jkl-single-target"/);
assert.match(source,/ui\.singleCurrent\.onclick\s*=\s*handlePanelSingleDownload/);
assert.match(source,/updateSingleDownloadPanel\(\);/);
assert.match(source,/singleDownloadState\.lastLocation\s*=\s*location\.href/);
assert.match(source,/location\.href !== singleDownloadState\.lastLocation/);
assert.equal(source.match(/@version\s+([0-9.]+)/)?.[1],'1.5.111');
console.log('Real panel solo click-to-media-info-to-download and age-gate overlay fallback, no transfer during scan, URL SPA updates — PASS.');
