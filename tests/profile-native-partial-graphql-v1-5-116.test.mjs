import fs from 'node:fs';
import assert from 'node:assert/strict';

// Synthetic native GraphQL traffic with the HAR-observed PAGE SHAPE ONLY.
// No private usernames, identifiers, cookies, cursors or media are included.
const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const pos=src.indexOf('    function '+name+'(');
    assert.ok(pos>=0,'missing production function: '+name);
    const end=src.indexOf('\n    }\n',pos);
    assert.ok(end>pos);
    return src.slice(pos,end+7);
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function encode(x) {
    let n=BigInt(x),s='';
    do { s=alphabet[Number(n%64n)]+s;n/=64n; } while(n>0n);
    return s;
}
function decode(code) {
    let n=0n;
    for(const c of String(code)) {
        const i=alphabet.indexOf(c);
        if(i<0) return '';
        n=n*64n+BigInt(i);
    }
    return n.toString();
}
const key='xdt_api__v1__feed__user_timeline_graphql_connection';
const keyed=(data,k)=>data?.data?.[k] || null;
const node=e=>e?.node || {};
const normalizePk=n=>String(n?.pk ?? n?.id ?? '').split('_')[0];
const canon=c=>String(c||'').length>28 ? String(c).slice(0,-28):String(c||'');
const pageProof=new Function('keyedConnection','GRID_CONNECTION_KEY',
    'edgeNode','normalizePk','canonicalShortcode','shortcodeId',
    extract('nativeProfilePageAdmissibility')+
    '\nreturn nativeProfilePageAdmissibility;'
)(keyed,key,node,normalizePk,canon,decode);
const parse=new Function(extract('nativeGraphQLResponsePayloads')+
    '\nreturn nativeGraphQLResponsePayloads;')();
const roots=Array.from({length:121},(_,i)=>String(101000+i));
function page(i,errorCount=0) {
    const ids=roots.slice(i*12,i*12+(i===10?1:12));
    return {
        data:{[key]:{edges:ids.map(id=>({node:{pk:id,code:encode(id)}})),
            page_info:{has_next_page:i!==10,end_cursor:i===10?null:'next-'+i}}},
        ...(errorCount?{errors:Array.from({length:errorCount},()=>({message:'synthetic field error'}))}:{}),
    };
}
assert.deepEqual(pageProof(page(0,5)),{
    allowed:true,errors:5,reason:'verified_partial_page',
});
assert.deepEqual(pageProof(page(10)),{
    allowed:true,errors:0,reason:'clean',
});
assert.equal(pageProof({errors:[{}],data:{}}).allowed,false);
const badId=page(0,1);
badId.data[key].edges[0].node.code=encode(9999999);
assert.equal(pageProof(badId).reason,'root_identity_invalid');
const badCursor=page(0,1);
badCursor.data[key].page_info.end_cursor=null;
assert.equal(pageProof(badCursor).reason,'cursor_absent');
const duplicate=page(0,1);
duplicate.data[key].edges[1]=duplicate.data[key].edges[0];
assert.equal(pageProof(duplicate).allowed,false);
const wrongKey={data:{other_connection:page(0,1).data[key]},errors:[{}]};
assert.equal(pageProof(wrongKey).reason,'missing_strict_page');
const badEnd=page(10,1);
delete badEnd.data[key].page_info.has_next_page;
assert.equal(pageProof(badEnd).allowed,false);
const doc=JSON.stringify(page(0,5));
assert.equal(parse(doc).length,1);
assert.equal(parse('for (;;);'+doc).length,1);
assert.equal(parse(doc+'\n'+JSON.stringify(page(1))).length,2,
    'native Relay JSON-lines must not be lost to whole-body JSON.parse');
assert.deepEqual(parse('<html>not a JSON response</html>'),[]);
assert.deepEqual(parse(doc+'\nnot JSON'),[],
    'a malformed second fragment must not become partial success');

// Exercise the actual production captureGrid, not a reimplementation.
const net={
    gridNativeAuditByUser:new Map(),gridByUser:new Map(),
    gridPageInfo:new Map(),gridCaptureSeenAtByUser:new Map(),
    gridDocByUser:new Map(),gridQueryByUser:new Map(),
    gridNativeInitialByUser:new Map(),gridNativeContinuationByUser:new Map(),
};
const logs=[];
const capture=new Function('GRID_NAMES','GRID_CONNECTION_KEY',
    'keyedConnection','gridConn','requestTargetsCurrentProfile','gridUser',
    'nativeProfilePageAdmissibility','edgeNode','normalizePk','log','net',
    extract('captureGrid')+'\nreturn captureGrid;'
)(new Set(['PolarisProfilePostsQuery','PolarisProfilePostsTabContentQuery_connection']),
    key,keyed,d=>keyed(d,key),m=>m?.variables?.username==='synthetic',
    ()=> 'synthetic',pageProof,node,normalizePk,(...a)=>logs.push(a),net);
for(let i=0;i<11;i++) {
    const errors=i===0?5:[2,4,7,8].includes(i)?1:0;
    capture(page(i,errors),{
        friendly:i===0?'PolarisProfilePostsQuery':'PolarisProfilePostsTabContentQuery_connection',
        variables:{username:'synthetic',count:12,...(i?{after:'previous-'+i}:{})},
        docId:'1234567890',endpoint:'api',bodyFields:{},relayHeaders:{},
    });
}
assert.equal(net.gridByUser.get('synthetic').size,121,
    'all 121 unique parent roots, including 60 roots on five partial-error pages');
assert.equal(net.gridNativeAuditByUser.get('synthetic').initial,1);
assert.equal(net.gridNativeAuditByUser.get('synthetic').continuation,10);
assert.equal(net.gridNativeAuditByUser.get('synthetic').lastHasNext,'false');
assert.equal(net.gridPageInfo.get('synthetic').has_next_page,false);
assert.equal(net.gridNativeInitialByUser.has('synthetic'),true);
assert.equal(net.gridNativeContinuationByUser.has('synthetic'),true);
assert.equal(logs.filter(([line])=>String(line).includes('GraphQL partial errors=')).length,5);
const before=net.gridByUser.get('synthetic').size;
capture(page(0,1),{
    friendly:'PolarisProfilePostsQuery',
    variables:{username:'another'},docId:'1234567890',
    endpoint:'api',bodyFields:{},relayHeaders:{},
});
assert.equal(net.gridByUser.get('synthetic').size,before,
    'unrelated profile query never contributes parent roots');
assert.match(src,/nativeGraphQLResponsePayloads\(text\)/);
assert.match(src,/nativeGraphQLResponsePayloads\(raw\)/);
assert.equal(src.match(/\/\/ @version\s+([0-9.]+)/)?.[1],'1.5.118');
console.log('HAR 11-page/121-root partial-error recovery + strict page/identity guards + JSON-lines parsing: PASS');
