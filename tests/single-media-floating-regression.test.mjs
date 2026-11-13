import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function fn(name) {
    const marker='    function '+name+'(';
    const a=src.indexOf(marker);
    assert.ok(a>=0,name+' source missing');
    const b=src.indexOf('\n    }\n',a);
    assert.ok(b>a,name+' unterminated');
    return src.slice(a,b+7);
}
const target={kind:'media',route:'reel',mediaId:'3797523949836352612',
    username:'petit._tigre',shortcode:'DSzg-mICLxk',key:'media:3797523949836352612'};
const rect=(left,top,width,height)=>({
    left,top,width,height,right:left+width,bottom:top+height
});
const dialog={
    getBoundingClientRect:()=>rect(180,65,880,760),
    querySelector:()=>null,
    querySelectorAll:()=>[], // interstitial: zero IMG/VIDEO
};
const window={innerWidth:1280,innerHeight:900};
let floating=null;
const body={
    appendChild(button){
        floating=button;
        button.parentElement=body;
        button.isConnected=true;
    }
};
const existingButton={
    id:'jkl-current-download',dataset:{},style:{},
    classList:{
        items:new Set(),
        add(key){this.items.add(key);},
        remove(key){this.items.delete(key);}
    },
    disabled:false,innerHTML:'<svg/>',
    remove(){floating=null;this.parentElement=null;this.isConnected=false;},
    parentElement:null,isConnected:false,
};
const document={
    body,
    getElementById(){return floating;},
    querySelectorAll(sel){
        if(sel==='div[role="dialog"]') return [dialog];
        if(sel==='article') return [];
        if(sel==='section') return [];
        return [];
    },
    querySelector:()=>null,
};
const ui={box:{getBoundingClientRect:()=>rect(2000,0,0,0)}};
const state={running:false,downloading:false,feedbackRequired:false,
    rateLimited:false,apiUnhealthy:false};
const singleDownloadState={lastOverlayDiagnostic:''};
const logs=[];
const getters=new Function(
    'window','document','storyPermalinkInfo','location',
    fn('currentMediaRoot')+'\nreturn currentMediaRoot;'
)(window,document,()=>null,{href:'https://www.instagram.com/petit._tigre/reel/DSzg-mICLxk/'});
assert.equal(getters(),dialog,'age-gated open dialog must not require IMG/VIDEO');

const biggest=new Function('window','document','location',
    'getComputedStyle',
    fn('largestCurrentMedia')+'\nreturn largestCurrentMedia;'
)(window,document,{pathname:'/petit._tigre/reel/DSzg-mICLxk/'},
    ()=>({display:'block',visibility:'visible'}));
assert.equal(biggest(dialog),null);

const pin=new Function('window','ui',
    fn('currentMediaOverlayHost')+'\nreturn currentMediaOverlayHost;'
)(window,ui);
const anchor=pin(null,dialog);
assert.deepEqual(anchor,{left:1012,top:77},
    'full-size age-gate dialog should pin to centered media frame');

const position=new Function('document','currentMediaOverlayHost','largestCurrentMedia',
    fn('placeCurrentDownloadButton')+'\nreturn placeCurrentDownloadButton;'
)(document,pin,biggest);
assert.equal(position(existingButton,dialog),'viewport-pinned-media');
assert.equal(floating,existingButton);
assert.equal(existingButton.style.left,'1012px');
assert.equal(existingButton.style.top,'77px');
assert.equal(existingButton.classList.items.has('jkl-media-download-overlay'),true);

const panelLogs=[];
const refresh=new Function('document','currentSingleDownloadTarget',
    'currentMediaRoot','largestCurrentMedia','currentMediaOverlayHost',
    'singleDownloadState','log','ensureCurrentDownloadButton',
    'applySingleDownloadTarget','placeCurrentDownloadButton','state',
    fn('refreshCurrentDownloadButton')+'\nreturn refreshCurrentDownloadButton;'
)(
    document,()=>target,getters,biggest,pin,singleDownloadState,
    (msg,lvl)=>panelLogs.push([msg,lvl]),
    ()=>existingButton,
    (button,t)=>{
        button.dataset.targetKind=t.kind;
        button.dataset.route=t.route;
        button.dataset.mediaId=t.mediaId;
        button.dataset.shortcode=t.shortcode;
        button.dataset.username=t.username;
    },
    position,state
);
refresh();
assert.equal(floating,existingButton,
    'actual refresh must leave the floating control on an age gate');
assert.equal(existingButton.dataset.mediaId,target.mediaId);
assert.equal(existingButton.disabled,false);
assert.equal(panelLogs.length,0);
state.running=true;
refresh();
assert.equal(existingButton.disabled,true,
    'bulk scan mutex must keep single download disabled');
state.running=false;
refresh();
assert.equal(existingButton.disabled,false);

const nativeClick=new Function('singleDownloadButtonFromEvent',
    'singleDownloadTargetFromButton','downloadSingleTarget','log','status',
    fn('handleSingleDownloadClick')+'\nreturn handleSingleDownloadClick;'
)(
    new Function(fn('singleDownloadButtonFromEvent')+
        '\nreturn singleDownloadButtonFromEvent;')(),
    button=>button===existingButton?target:null,
    t=>logs.push('download:'+t.mediaId),
    ()=>{},()=>{}
);
const eventCalls=[];
nativeClick({
    target:{closest:(sel)=>sel.includes('#jkl-current-download')?existingButton:null},
    preventDefault:()=>eventCalls.push('preventDefault'),
    stopPropagation:()=>eventCalls.push('stopPropagation'),
    stopImmediatePropagation:()=>eventCalls.push('stopImmediatePropagation'),
});
assert.deepEqual(eventCalls,['preventDefault','stopPropagation','stopImmediatePropagation']);
assert.deepEqual(logs,['download:'+target.mediaId],
    'floating button click must invoke existing single-download controller');

// If our panel overlaps the top-right of the media, pin to top-left.
ui.box.getBoundingClientRect=()=>rect(900,0,360,300);
assert.deepEqual(pin(null,dialog),{left:192,top:77});

// One grid tile should support CSS art with no IMG/VIDEO, survive React
// deleting our own button while preserving the original anchor dataset.
const tile=rect(40,240,235,235);
let held=[];
const host={
    children:held,dataset:{},style:{},parentElement:body,
    appendChild(button){held.push(button);button.isConnected=true;button.parentElement=host;}
};
const anchorNode={
    isConnected:true,href:'https://www.instagram.com/reel/DSzg-mICLxk/',
    dataset:{},parentElement:host,
    getBoundingClientRect:()=>tile,
    closest:()=>null
};
const grid=new Function('window','document','location',
    'singleDownloadTargetFromUrl','getComputedStyle','singleDownloadIconHtml',
    'applySingleDownloadTarget',
    fn('addSingleDownloadButtonToAnchor')+
    '\nreturn addSingleDownloadButtonToAnchor;'
)(
    window,{
        ...document,
        createElement:()=>({
            dataset:{},classList:{contains:k=>k==='jkl-single-download'},
            innerHTML:'',isConnected:false
        })
    },
    {href:'https://www.instagram.com/petit._tigre/'},
    ()=>target,()=>({position:'static'}),()=>'<svg/>',
    (button,t)=>{button.dataset.mediaId=t.mediaId;}
);
grid(anchorNode);
assert.equal(held.length,1);
assert.equal(held[0].dataset.mediaId,target.mediaId);
assert.equal(held[0].isConnected,true);
const first=held[0];
first.isConnected=false;
first.remove=()=>{held.splice(held.indexOf(first),1);};
grid(anchorNode);
assert.equal(held.length,1);
assert.notEqual(held[0],first);
assert.equal(anchorNode.dataset.jklSingleDownload,'1');
grid(anchorNode);
assert.equal(held.length,1,'idempotent overlay placement');

assert.match(src,/position:fixed;\s*z-index:2147483645;/);
assert.match(src,/window\.addEventListener\(\s*'scroll'/);
assert.match(src,/window\.addEventListener\(\s*'resize'/);
assert.match(src,/\.jkl-single-download \{[\s\S]*?opacity:\.82;/);
assert.match(src,/\(p\|reels\?\|tv\)/);
assert.equal(src.match(/@version\s+([0-9.]+)/)?.[1],'1.5.117');
console.log('Age gate no IMG: pinned SOLO button visible, real click delegated, scan disabled, panel overlap avoided, React tile replacement and /reels/ supported — PASS.');
