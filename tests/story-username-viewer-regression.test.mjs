import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name, async=false) {
    const i=src.indexOf('    '+(async?'async function ':'function ')+name+'(');
    assert.ok(i>=0,'missing production '+name);
    const end=src.indexOf('\n    }\n',i);
    assert.ok(end>i,'unterminated production '+name);
    return src.slice(i,end+7);
}

const location={origin:'https://www.instagram.com',
    href:'https://www.instagram.com/stories/b_kkaaa/'};
const cleanUser=x=>String(x||'').replace(/[^A-Za-z0-9._]/g,'');
const storyViewerRouteInfo=new Function('location','cleanUser',
    extract('storyViewerRouteInfo')+'\nreturn storyViewerRouteInfo;')(location,cleanUser);
const viewer=storyViewerRouteInfo(location.href);
assert.deepEqual(viewer,{
    kind:'story-viewer',route:'story',username:'b_kkaaa',
    mediaId:'',shortcode:'',key:'story-viewer:b_kkaaa',
});
assert.equal(storyViewerRouteInfo('https://www.instagram.com/stories/highlights/17912345/'),null);
assert.equal(storyViewerRouteInfo('https://www.instagram.com/stories/b_kkaaa/123456789/'),null);
assert.equal(storyViewerRouteInfo('https://www.instagram.com/b_kkaaa/'),null);
assert.equal(storyViewerRouteInfo('https://www.instagram.com/stories/unrelated/?x=y')?.username,'unrelated');

const singleDownloadTargetFromUrl=new Function('storyViewerRouteInfo',
    'storyPermalinkInfo','mediaPermalinkInfo',
    extract('singleDownloadTargetFromUrl')+'\nreturn singleDownloadTargetFromUrl;'
)(storyViewerRouteInfo,()=>null,()=>null);
assert.equal(singleDownloadTargetFromUrl(location.href)?.kind,'story-viewer',
    'exact user-provided Firefox route must resolve without a numeric media ID');

const rect=(left,top,width,height)=>({
    left,top,width,height,right:left+width,bottom:top+height,
});
const window={innerWidth:1360,innerHeight:900};
const ui={box:{getBoundingClientRect:()=>rect(1500,0,0,0)}};
let overlay=null;
let visibleMedia=[];
const body={appendChild(el){overlay=el;el.parentElement=body;el.isConnected=true;}};
const document={body,querySelectorAll(selector){
        assert.equal(selector,'video,img');return visibleMedia;
    },
    getElementById(){return overlay;},
};
const storyFloatingAnchor=new Function('location','window','document','ui',
    'storyPermalinkInfo','storyViewerRouteInfo',
    extract('storyFloatingAnchor')+'\nreturn storyFloatingAnchor;'
)(location,window,document,ui,()=>null,storyViewerRouteInfo);
assert.deepEqual(storyFloatingAnchor(viewer),{left:872,top:92},
    'username-only route must show floating control without IMG/VIDEO');
assert.equal(storyFloatingAnchor({...viewer,username:'other'}),null,
    'account mismatch must hide floating control');
location.href='https://www.instagram.com/stories/highlights/17912345/';
assert.equal(storyFloatingAnchor(viewer),null,
    'highlight route without story ID must not invent an individual target');
location.href='https://www.instagram.com/stories/b_kkaaa/';

const button={dataset:{},style:{},disabled:false,isConnected:false,
    innerHTML:'<svg/>',parentElement:null,classList:{
        bag:new Set(),add(x){this.bag.add(x)},contains(x){return this.bag.has(x)},
    },
    remove(){overlay=null;this.isConnected=false;this.parentElement=null},
};
const placeCurrentDownloadButton=new Function(
    'document','currentMediaOverlayHost','largestCurrentMedia',
    extract('placeCurrentDownloadButton')+'\nreturn placeCurrentDownloadButton;'
)(document,()=>null,()=>null);
const state={running:false,downloading:false,feedbackRequired:false,
    rateLimited:false,apiUnhealthy:false};
const singleDownloadState={lastOverlayDiagnostic:''};
const logs=[];
const refresh=new Function('document','currentSingleDownloadTarget',
    'currentMediaRoot','largestCurrentMedia','currentMediaOverlayHost',
    'storyFloatingAnchor','singleDownloadState','log',
    'ensureCurrentDownloadButton','applySingleDownloadTarget',
    'placeCurrentDownloadButton','state',
    extract('refreshCurrentDownloadButton')+'\nreturn refreshCurrentDownloadButton;'
)(document,()=>singleDownloadTargetFromUrl(location.href),()=>null,
    ()=>null,()=>null,storyFloatingAnchor,singleDownloadState,
    (...x)=>logs.push(x),()=>button,(btn,target)=>{
        btn.dataset.targetKind=target.kind;
        btn.dataset.mediaId=target.mediaId;
        btn.dataset.username=target.username;
    },placeCurrentDownloadButton,state);
refresh();
assert.equal(overlay,button,'button must be inserted on user-only viewer route');
assert.equal(overlay.dataset.targetKind,'story-viewer');
assert.equal(overlay.dataset.mediaId,'','viewer is not falsely marked as exact story ID');
assert.equal(overlay.style.left,'872px');
assert.equal(overlay.dataset.placement,'viewport-pinned-story');
assert.equal(overlay.disabled,false);
assert.equal(logs.length,0);
const buttonTarget=new Function('location','canonicalShortcode','cleanUser',
    'storyViewerRouteInfo','currentSingleDownloadTarget',
    extract('singleDownloadTargetFromButton')+'\nreturn singleDownloadTargetFromButton;'
)(location,x=>x,cleanUser,storyViewerRouteInfo,()=>viewer);
assert.deepEqual(buttonTarget(button),viewer,'click target preserves viewer identity without invented ID');
state.running=true;refresh();assert.equal(overlay.disabled,true);
state.running=false;refresh();assert.equal(overlay.disabled,false);
location.href='https://www.instagram.com/stories/highlights/17912345/';
assert.equal(buttonTarget(button),null,
    'a stale username-only Story button must never become a different click target');
refresh();assert.equal(overlay,null,'overlay removed after leaving user-only Story');
location.href='https://www.instagram.com/stories/b_kkaaa/';

// Exercise real production resolver logic, not a copied algorithm.
const storyAssetKey=new Function(extract('storyAssetKey')+'\nreturn storyAssetKey;')();
assert.equal(storyAssetKey('https://scontent.cdninstagram.com/a/abc.jpg?st=old'),'/a/abc.jpg');
assert.equal(storyAssetKey('blob:https://www.instagram.com/abc'),'');
const storyItemAssetKeys=new Function('storyAssetKey','bestVideo','bestImage',
    extract('storyItemAssetKeys')+'\nreturn storyItemAssetKeys;'
)(storyAssetKey,x=>x?.video_url||'',x=>x?.display_url||'');
assert.equal(storyItemAssetKeys({display_url:'https://scontent.cdninstagram.com/a/abc.jpg?st=next'})
    .has('/a/abc.jpg'),true);

const id1='4029055053167733140';
const id2='4029055053167733141';
const story1={pk:id1,display_url:'https://scontent.cdninstagram.com/a/first.jpg'};
const story2={pk:id2,display_url:'https://scontent.cdninstagram.com/a/second.jpg'};
let itemList=[story1], calls=[],currentlyVisible='';
let currentAccount='b_kkaaa';
const fetchWebStoryReel=async userId=>{
    calls.push(['reel',userId]);
    return [{id:userId,items:itemList}];
};
const fetchStandaloneMediaInfo=async id=>{
    calls.push(['media',id]);return {pk:id};
};
const resolveStoryViewerItem=new Function(
    'storyViewerRouteInfo','location','storyVisibleAssetKey',
    'state','fetchProfilePageMetadata','fetchWebStoryReel','hiId',
    'normalizePk','storyItemAssetKeys','log','fetchStandaloneMediaInfo',
    extract('resolveStoryViewerItem',true)+'\nreturn resolveStoryViewerItem;'
)(storyViewerRouteInfo,location,()=>currentlyVisible,
    {username:'b_kkaaa',userId:'45374661889'},
    async()=>{throw Error('should use known verified account')},
    fetchWebStoryReel,x=>x,x=>String(x?.pk||''),
    storyItemAssetKeys,()=>{},fetchStandaloneMediaInfo);

calls=[];
assert.deepEqual(await resolveStoryViewerItem(viewer),{pk:id1});
assert.deepEqual(calls,[['reel','45374661889'],['media',id1]],
    'one server-authenticated item selected only on click');
itemList=[story1,story2];currentlyVisible='';
calls=[];
await assert.rejects(resolveStoryViewerItem(viewer),/ambigu/);
assert.deepEqual(calls,[['reel','45374661889']],
    'ambiguous multi-Story viewer must NEVER call a media download');
currentlyVisible='/a/second.jpg';calls=[];
assert.deepEqual(await resolveStoryViewerItem(viewer),{pk:id2});
assert.deepEqual(calls,[['reel','45374661889'],['media',id2]],
    'multi-Story selection uses exact matching visible asset');
currentlyVisible='/a/unrelated.jpg';calls=[];
await assert.rejects(resolveStoryViewerItem(viewer),/ambigu/);
assert.deepEqual(calls,[['reel','45374661889']]);
location.href='https://www.instagram.com/stories/other/';
calls=[];await assert.rejects(resolveStoryViewerItem(viewer),/ne correspond/);
assert.equal(calls.length,0,'wrong-account route must not start API requests');
location.href='https://www.instagram.com/stories/b_kkaaa/';

assert.ok(src.includes("!/^\\d+$/.test(id) && resolved.kind!=='story-viewer'"),
    'download guard must distinguish account-only Story from a numeric root');

const transfers=[],finalStatuses=[];
const transferState={running:false,downloading:false,
    feedbackRequired:false,rateLimited:false,apiUnhealthy:false};
const testButton={isConnected:true,innerHTML:'<svg/>',disabled:false,
    classList:{bag:new Set(),add(k){this.bag.add(k)},
        remove(k){this.bag.delete(k)},contains(k){return this.bag.has(k)}},
};
const manualDownload=new Function(
    'state','singleDownloadState','status','log',
    'fetchStandaloneMediaInfo','resolveStoryViewerItem','normalizePk',
    'standaloneUnits','downloadStandaloneFile','sleep','APP','setTimeout',
    extract('downloadSingleTarget',true)+'\nreturn downloadSingleTarget;'
)(
    transferState,{busy:new Set()},
    (...x)=>finalStatuses.push(x),()=>{},
    async()=>{throw Error('viewer cannot use an invented numeric root')},
    async()=>({pk:id1}),x=>String(x?.pk||''),
    (item,forced,expected)=>{
        assert.equal(item.pk,id1);
        assert.equal(forced,'STORY');
        assert.equal(expected,id1);
        return [{id:id1,filename:'story.mp4'}];
    },
    async file=>{
        assert.equal(transferState.downloading,true,
            'global operation mutex must guard user-only Story transfer');
        transfers.push(file.id);
    },
    async()=>{}, {DOWNLOAD_DELAY:0},()=>0
);
await manualDownload(viewer,testButton);
assert.deepEqual(transfers,[id1],
    'username-only floating SOLO click must use verified root and existing downloader');
assert.equal(transferState.downloading,false);
assert.equal(finalStatuses.at(-1)?.[1],'ok');

assert.match(src,/resolveStoryViewerItem\(resolved\)/,
    'button click must resolve the viewer before invoking normal media-info downloader');
assert.equal(src.match(/@version\s+([0-9.]+)/)?.[1],'1.5.110');
console.log('v1.5.110: actual username-only Firefox URL, overlay, single/multiple Story click-time verification and safe refusal — PASS');
