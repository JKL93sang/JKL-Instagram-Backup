import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name){
    const i=src.indexOf('    function '+name+'(');
    assert.ok(i>=0,'missing production function '+name);
    const end=src.indexOf('\n    }\n',i);
    assert.ok(end>i,'unterminated production function '+name);
    return src.slice(i,end+7);
}
const storyId='4029055053167733140'; // actual logged Story identity; no media URL
const username='b_kkaaa';
const location={
    origin:'https://www.instagram.com',
    href:'https://www.instagram.com/stories/'+username+'/'+storyId+'/',
    pathname:'/stories/'+username+'/'+storyId+'/',
};
const storyRoute=new Function('location','cleanUser',
    extract('storyPermalinkInfo')+'\nreturn storyPermalinkInfo;'
)(location,x=>String(x||'').replace(/[^A-Za-z0-9._]/g,''));
const story=storyRoute(location.href);
assert.deepEqual(story,{
    kind:'story',route:'story',username,mediaId:storyId,
    shortcode:'',key:'story:'+storyId
});
const rect=(left,top,width,height)=>({
    left,top,width,height,right:left+width,bottom:top+height,
});
const window={innerWidth:1360,innerHeight:900};
let visibleMedia=[];
let overlay=null;
const body={appendChild(el){overlay=el;el.parentElement=body;el.isConnected=true;}};
const document={
    body,
    querySelectorAll(selector){
        assert.equal(selector,'video,img');
        return visibleMedia;
    },
    getElementById(){return overlay;},
};
const ui={box:{getBoundingClientRect:()=>rect(1500,0,0,0)}};
const anchor=new Function('location','window','document','ui','storyPermalinkInfo',
    extract('storyFloatingAnchor')+'\nreturn storyFloatingAnchor;'
)(location,window,document,ui,storyRoute);

assert.deepEqual(anchor(story),{left:872,top:92},
    'no main/section/IMG/VIDEO must still expose the SOLO control for exact Story URL');
const wrong={...story,mediaId:'12345678'};
assert.equal(anchor(wrong),null,'a different story identity must never reuse the anchor');
assert.equal(anchor({...story,username:'unrelated'}),null,
    'a different account must never borrow the current Story target');
const invalidHref=location.href;
location.href='https://www.instagram.com/stories/highlights/17812345678/';
assert.equal(anchor(story),null,
    'highlight reel without current story media ID must not guess an individual download');
location.href='https://www.instagram.com/b_kkaaa/';
assert.equal(anchor(story),null,'profile URL is not a single-Story media target');
location.href=invalidHref;

const media=(tag,r)=>({
    tagName:tag,
    closest:()=>null,
    getBoundingClientRect:()=>r,
});
visibleMedia=[
    media('IMG',rect(15,15,80,80)), // profile avatar must not win
    media('VIDEO',rect(480,120,400,680)),
];
assert.deepEqual(anchor(story),{left:832,top:176},
    'a real visible centered Story VIDEO should position the control near the video');
visibleMedia=[];

const button={
    dataset:{},style:{},disabled:false,isConnected:false,
    innerHTML:'<svg/>',parentElement:null,
    classList:{
        items:new Set(),
        add(x){this.items.add(x);},
        contains(x){return this.items.has(x);},
    },
    remove(){overlay=null;this.isConnected=false;this.parentElement=null;},
};
const position=new Function('document','currentMediaOverlayHost',
    'largestCurrentMedia',
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
)(
    document,()=>story,()=>null,()=>null,()=>null,anchor,
    singleDownloadState,(line,level)=>logs.push({line,level}),
    ()=>button,(btn,target)=>{
        btn.dataset.targetKind=target.kind;
        btn.dataset.mediaId=target.mediaId;
        btn.dataset.username=target.username;
    },
    position,state
);
refresh();
assert.equal(overlay,button);
assert.equal(overlay.dataset.mediaId,storyId);
assert.equal(overlay.dataset.targetKind,'story');
assert.equal(overlay.dataset.username,username);
assert.equal(overlay.style.left,'872px');
assert.equal(overlay.style.top,'92px');
assert.equal(overlay.dataset.placement,'viewport-pinned-story');
assert.equal(overlay.disabled,false);
assert.equal(logs.length,0);
state.running=true;refresh();
assert.equal(overlay.disabled,true,'scan/download mutex must still disable SOLO');
state.running=false;refresh();
assert.equal(overlay.disabled,false);
state.feedbackRequired=true;refresh();
assert.equal(overlay.disabled,true,'Instagram feedback circuit breaker preserved');
state.feedbackRequired=false;
location.href='https://www.instagram.com/stories/highlights/17812345678/';
refresh();
assert.equal(overlay,null,'no floating media action for ambiguous highlight reel');
assert.equal(logs.length,1);
assert.match(logs[0].line,/no safe visible region/);

assert.match(src,/TAGGED_HYDRATION_LIMIT:\s*16\b/);
assert.match(src,/hydrationAttempts\s*<\s*APP.TAGGED_HYDRATION_LIMIT/);
assert.ok(!src.includes('TAGGED REST fallback requested'));
assert.match(src,/profileDomMediaInfoFailureCode\(info,item,state.userId\)/);
assert.equal(src.match(/@version\s+([0-9.]+)/)?.[1],'1.5.107');
console.log('v1.5.107: real Story URL SOLO visible without main/section; exact target, media positioning, no highlight guessing, scan mutex, TAGGED bounded recovery — PASS');
