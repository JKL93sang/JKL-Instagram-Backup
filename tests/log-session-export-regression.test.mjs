import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url),'utf8'
);
function extract(name) {
    const marker='    function '+name+'(';
    const pos=source.indexOf(marker);
    assert.ok(pos>=0, 'missing executable function '+name);
    const end=source.indexOf('\n    }\n',pos);
    assert.ok(end>pos,'unclosed function '+name);
    return source.slice(pos,end+7);
}
const APP={NAME:'JKL Instagram Backup',VERSION:'1.5.111',
    MAX_LOG:2000,MAX_LOG_ARCHIVE:50000};
assert.match(source, /MAX_LOG:\s*2000\s*,\s*MAX_LOG_ARCHIVE:\s*50000/,
    'display capacity and longer-lived log archive required');
assert.match(source, /id="jkl-export-logs"/);
assert.match(source, /id="jkl-log-counter"/);
assert.match(source, /ui\.exportLogs\.onclick\s*=\s*exportLogs/);
const disable=extract('disable');
assert.ok(!disable.includes("'exportLogs'"),
    'export must remain available during long downloads');
assert.equal(source.match(/@version\s+([0-9.]+)/)?.[1],APP.VERSION);

const nodeList=[];
const container={
    get childElementCount(){return nodeList.length;},
    get firstElementChild(){return nodeList[0]||null;},
    appendChild(node){nodeList.push(node);},
    scrollHeight:100,scrollTop:0,
};
let clickCount=0,downloadFilename='',storedBlob=null,revoked='';
const document={
    body:{appendChild(){}},
    createElement(kind){
        if(kind==='div')return {
            textContent:'',className:'',
            remove(){const n=nodeList.indexOf(this);if(n>=0)nodeList.splice(n,1);}
        };
        if(kind==='a')return {
            href:'',download:'',
            click(){clickCount++;downloadFilename=this.download;},
            remove(){}
        };
        throw Error('unknown DOM node '+kind);
    },
};
const fakeURL={
    createObjectURL(blob){storedBlob=blob;return 'blob:mock-logs';},
    revokeObjectURL(url){revoked=url;},
};
const timeouts=[];
const setTimeout=fn=>{timeouts.push(fn);return timeouts.length;};
const ui={log:container,logCounter:{textContent:''},
    username:{value:'petit._tigre'},
    status:{textContent:'',dataset:{}}};
const state={username:'petit._tigre',settings:{debug:false}};
const logArchive={startedAt:new Date(2026,10,11,1,35),
    entries:[],dropped:0,accounts:new Set()};
const cleanUser=value=>String(value||'').trim().replace(/^@/,'')
    .replace(/[^A-Za-z0-9._]/g,'');
const sanitize=value=>String(value||'').replace(/[\\/:*?"<>|]/g,'_');
const moduleSource=['log','logExportFilename','buildLogExport','exportLogs','status']
    .map(extract).join('\n');
const api=new Function('APP','state','ui','logArchive','document','URL',
    'Blob','setTimeout','sanitize','cleanUser','currentProfile',
    moduleSource+
    '\nreturn {log,logExportFilename,buildLogExport,exportLogs};'
)(APP,state,ui,logArchive,document,fakeURL,Blob,setTimeout,sanitize,
  cleanUser,()=>state.username);

assert.equal(api.logExportFilename(
    '@petit._tigre',new Date(2026,10,11,1,54,23)
),'petit._tigre - Instagram Backup Logs - 2026-11-11_01-54-23.txt');

ui.log=null;
api.log('Initial scan before UI mounted');
assert.equal(logArchive.entries.length,1,
    'bootstrap lines must be kept even without DOM');
ui.log=container;

for(let i=1;i<=2350;i++){
    api.log('✓ petit._tigre - REEL - média '+String(i).padStart(4,'0'));
}
assert.equal(nodeList.length,2000,'2000 most recent lines visible');
assert.equal(logArchive.entries.length,2351,
    'export must not be limited by DOM eviction');
assert.equal(logArchive.dropped,0);
assert.ok(nodeList[0].textContent.includes('média 0351'),
    'first 351 lines should be absent from DOM only');
assert.ok(logArchive.entries[0].includes('Initial scan before UI mounted'));
assert.equal(ui.logCounter.textContent,'2000 visible / 2351 archivées');

api.exportLogs();
assert.equal(clickCount,1,'button requests exactly one TXT save');
assert.match(downloadFilename,
    /^petit\._tigre - Instagram Backup Logs - \d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.txt$/);
assert.ok(storedBlob instanceof Blob,'Blob export, not remote request');
assert.equal(storedBlob.type,'text/plain;charset=utf-8');
const exported=await storedBlob.text();
assert.deepEqual([...new Uint8Array(await storedBlob.arrayBuffer()).slice(0,3)],
    [0xef,0xbb,0xbf],'UTF-8 BOM bytes for Windows editors');
assert.ok(exported.includes('\r\n'),'real CRLF separators required');
assert.ok(!exported.includes('\\r\\n'),'literal backslashes are invalid');
assert.ok(exported.includes('Initial scan before UI mounted'));
assert.ok(exported.includes('média 0001'));
assert.ok(exported.includes('média 2350'));
assert.ok(exported.includes('Entrées conservées : 2351'));
assert.ok(exported.includes('Compte actif : @petit._tigre'));
assert.ok(exported.includes('Historique intégral de cette session en mémoire.'));
assert.match(ui.status.textContent,/2351 lignes/);
assert.equal(ui.status.dataset.level,'ok');
assert.equal(timeouts.length,1,'object URL should be revoked after download');
timeouts[0]();
assert.equal(revoked,'blob:mock-logs');

logArchive.entries=Array.from({length:APP.MAX_LOG_ARCHIVE},(_,i)=>'old-'+i);
logArchive.dropped=0;
api.log('boundary line');
assert.equal(logArchive.entries.length,49001,
    'large log archive is evicted in amortized chunks');
assert.equal(logArchive.dropped,1000);
assert.equal(logArchive.entries[0],'old-1000');
assert.ok(api.buildLogExport('petit._tigre').includes(
    'ATTENTION : historique partiel (limite de mémoire atteinte).'
));
assert.ok(api.buildLogExport('petit._tigre').includes(
    'Anciennes entrées supprimées : 1000'
));
assert.ok(!api.buildLogExport('petit._tigre').includes('old-0\r\n'));

console.log('Real log/UI functions: 2000 visible, 2351 exported, timestamped TXT, Unicode, CRLF/BOM, archive cap and in-flight export — PASS.');
