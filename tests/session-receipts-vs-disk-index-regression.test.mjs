import fs from 'node:fs';
import assert from 'node:assert/strict';

// Regression: GM_download onload is NOT evidence that Firefox created a
// file under the selected archive folder. No Instagram or file writes.
const source=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const marker=new RegExp('    (?:async )?function '+name+'\\(').exec(source);
    assert.ok(marker,'missing production '+name);
    const end=source.indexOf('\n    }\n',marker.index);
    assert.ok(end>marker.index,'unfinished production '+name);
    return source.slice(marker.index,end+7);
}
const state={
    username:'synthetic', userId:'123',
    settings:{force:false},cancelled:false,
    downloaded:0, failed:0, diskActive:false,
    diskCanonical:new Set(),diskCanonicalMeta:new Map(),
    diskLocations:new Map(),diskPaths:new Map(),
    diskHidden:new Set(),diskStoryHighlight:new Set(),
    highlightRenameNotices:new Set(),legacy:new Map(),
    sessionPaths:new Map(),sessionCategories:new Map(),
    sessionAccepted:0,diskIndexStats:null,
    queue:new Map(),
};
const logs=[],statuses=[],written=[];
let transfers=0;
const mediaArchiveCategory=m=>m.type==='HIGHLIGHT'?'HIGHLIGHTS':m.type==='REEL'?'REELS':'POSTS';
const folder=(id,category='POSTS')=>({
    name:`synthetic - POST - 2026_11_11 - ${id}.jpg`,
    webkitRelativePath:`synthetic/synthetic - ${category}/synthetic - POST - 2026_11_11 - ${id}.jpg`
});
const old=folder('900'),newFile=folder('1234');
const media={id:'1234',filename:newFile.name,type:'POST',
    url:'https://cdn.invalid/1234.jpg',sources:new Set(['NATIVE'])};
state.queue.set(media.id,media);
const loaded=new Function('ctx',`
const {
    state,APP,performance,mediaArchiveCategory,matchesHighlightArchivePath,
    legacyMatch,canonicalShortcode,reportHighlightFolderRenames,
    updateStats,status,log,downloadAttempt,recordDownloaded,
    markDownloadOperation,sleep,rand,archiveDownloadPath
}=ctx;
${['existingReason','indexFolder','diskSatisfiesOwnedRoot',
    'downloadMainOne'].map(extract).join('\n')}
return {existingReason,indexFolder,diskSatisfiesOwnedRoot,downloadMainOne};
`)({
    state,APP:{DOWNLOAD_RETRIES:3},
    performance,mediaArchiveCategory,
    matchesHighlightArchivePath:(m,p)=>p.includes(String(m.highlightId||'')),
    legacyMatch:()=>false,canonicalShortcode:x=>x,
    reportHighlightFolderRenames:()=>{},
    updateStats:()=>{},status:(...a)=>statuses.push(a),
    log:(...a)=>logs.push(a),
    downloadAttempt:async()=>{transfers++;return {
        requestedPath:'synthetic/synthetic - POSTS/'+newFile.name,
    };},
    recordDownloaded:m=>written.push(m.id),
    markDownloadOperation:()=>{},sleep:async()=>{},rand:()=>0,
    archiveDownloadPath:m=>'synthetic/synthetic - POSTS/'+m.filename,
});
loaded.indexFolder([old]);
assert.equal(state.diskActive,true);
assert.equal(state.diskCanonical.size,1);
assert.equal(state.diskIndexStats.selectedFiles,1);
assert.equal(loaded.existingReason(media),null);

assert.equal(await loaded.downloadMainOne(media),true);
assert.equal(transfers,1);
assert.equal(written.length,1);
assert.equal(state.diskCanonical.size,1,
    'successful GM callback must NOT increase folder-indexed file count');
assert.equal(state.diskIndexStats.selectedFiles,1,
    'old folder selection cannot silently gain unindexed files');
assert.equal(state.diskCanonicalMeta.has('1234'),false,
    'callback metadata cannot impersonate real indexed file metadata');
assert.equal(loaded.existingReason(media),'SESSION');
assert.equal(loaded.existingReason({...media,type:'REEL'}),null,
    'session media receipt must not match another archive category');

assert.equal(loaded.diskSatisfiesOwnedRoot({
    structureComplete:true,expectedUnits:1,
    knownUnitIds:new Set(['1234']),type:'POST'
}),false,'onload callback cannot satisfy offline owned-root disk proof');
assert.equal(await loaded.downloadMainOne(media),true);
assert.equal(transfers,1,'accepted session receipt prevents duplicate transfer');

loaded.indexFolder([old]);
assert.equal(loaded.existingReason(media),null,
    'a later folder reindex without the file must reject old receipts');
assert.equal(state.sessionCategories.size,0);
assert.equal(state.sessionPaths.size,0);
assert.equal(state.diskCanonical.size,1);

loaded.indexFolder([old,newFile]);
assert.equal(state.diskCanonical.size,2);
assert.equal(loaded.existingReason(media),'DISK',
    'real folder-indexed matching file authorizes disk-based skip');
assert.equal(loaded.diskSatisfiesOwnedRoot({
    structureComplete:true,expectedUnits:1,
    knownUnitIds:new Set(['1234']),type:'POST'
}),true,'actual folder index can satisfy owned-root disk proof');

state.sessionCategories.set('777',new Set(['HIGHLIGHTS']));
state.sessionPaths.set('777',new Set(['synthetic/synthetic - HIGHLIGHTS/other-reel/777.jpg']));
const highlight={id:'777',type:'HIGHLIGHT',highlightId:'178001'};
assert.equal(loaded.existingReason(highlight),null,
    'a HIGHLIGHT receipt in a different reel folder must not match');
state.sessionPaths.get('777').add('synthetic/synthetic - HIGHLIGHTS/reel 178001/777.jpg');
assert.equal(loaded.existingReason(highlight),'SESSION');

assert.ok(!extract('downloadMainOne').includes('state.diskCanonicalMeta'),
    'the production download callback must never set disk metadata');
assert.ok(source.includes('GM_download success callbacks (disk not independently verified)'));
assert.ok(source.includes('Session receipts are not disk verification.'));
console.log('Folder index vs GM_download receipts, category, highlight, reindex: PASS');
