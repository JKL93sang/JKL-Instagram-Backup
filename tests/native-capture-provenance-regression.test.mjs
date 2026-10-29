import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url),
    'utf8'
);

function extract(name) {
    const token = '    function ' + name + '(';
    const alt = '    async function ' + name + '(';
    let start = source.indexOf(token);
    if (start < 0) start = source.indexOf(alt);
    assert.ok(start >= 0, 'missing function ' + name);
    const end = source.indexOf('\n    }\n', start);
    assert.ok(end > start, 'missing end of ' + name);
    return source.slice(start, end + 7);
}

const net = {
    nativeFetch:null,
    gridByUser:new Map(),
    gridPageInfo:new Map(),
    gridDocByUser:new Map(),
    gridQueryByUser:new Map(),
    gridNativeAuditByUser:new Map(),
    gridNativeContinuationByUser:new Map(),
};
const friendly = 'PolarisProfilePostsTabContentQuery_connection';
const makeConnection = (hasNext, mediaId='123') => ({
    edges:[{node:{id:mediaId}}],
    page_info:{has_next_page:hasNext,end_cursor:hasNext?'opaque-next':null}
});
const capture = new Function(
    'net','GRID_NAMES','requestTargetsCurrentProfile',
    'gridUser','gridConn','edgeNode','normalizePk',
    extract('captureGrid')+'\nreturn captureGrid;'
)(
    net,new Set([friendly]),
    m=>m.variables?.username==='sample.account',
    m=>m.variables.username.toLowerCase(),
    d=>d?.data?.profile_connection,
    e=>e.node,
    n=>n.id
);

const nativeMeta = {
    friendly,docId:'123456',
    endpoint:'api',
    variables:{username:'sample.account',data:{count:12}},
    bodyFields:{fb_dtsg:'PRIVATE-TOKEN',doc_id:'123456'},
    relayHeaders:{'x-fb-friendly-name':friendly},
};
capture({data:{profile_connection:makeConnection(true)}}, nativeMeta);
assert.equal(net.gridNativeAuditByUser.get('sample.account').initial,1);
assert.equal(net.gridNativeAuditByUser.get('sample.account').continuation,0);
assert.equal(net.gridNativeContinuationByUser.size,0,
    'An initial native page is not proof of continuation format'
);

const continuation = {
    ...nativeMeta,variables:{...nativeMeta.variables,after:'opaque-cursor',first:12},
};
capture({data:{profile_connection:makeConnection(false,'456')}},continuation);
assert.equal(net.gridNativeAuditByUser.get('sample.account').continuation,1);
assert.equal(
    net.gridNativeContinuationByUser.get('sample.account').variables.after,
    'opaque-cursor'
);
assert.equal(net.gridByUser.get('sample.account').size,2);
assert.equal(net.gridNativeAuditByUser.get('sample.account').lastHasNext,'false');
assert.equal(net.gridNativeContinuationByUser.get('sample.account')
    .template.body.fb_dtsg,'PRIVATE-TOKEN',
    'Replay data stays in memory but must never be put in logs'
);

const wrong = {...nativeMeta,variables:{username:'other.account'}};
capture({data:{profile_connection:makeConnection(true,'999')}},wrong);
assert.equal(net.gridByUser.get('sample.account').size,2);
capture({
    data:{profile_connection:makeConnection(true,'999')},
    errors:[{message:'failure'}]
},nativeMeta);
assert.equal(net.gridByUser.get('sample.account').size,2,
    'Rejected GraphQL payload must not establish native proof'
);

const observed = extract('summarizeGraphQlErrors');
const summarize = new Function(
    observed + '\nreturn summarizeGraphQlErrors;'
)();
const sensitive = 'SECRET_TOKEN 123private@example.com https://instagram.com/private/';
const summary = summarize([
    {message:'execution error '+sensitive,code:1675012,severity:'CRITICAL',
        mids:['SECRET_DEBUG_ID'],fbtrace_id:'SENSITIVE'},
]);
assert.ok(summary.includes('kind=server_execution'));
assert.ok(summary.includes('code=1675012'));
assert.ok(summary.includes('severity=CRITICAL'));
assert.ok(!summary.includes(sensitive));
assert.ok(!summary.includes('SECRET'));
assert.ok(!summary.includes('private@example'));
assert.ok(!summary.includes('SENSITIVE'));

const fetchText = extract('fetchJson');
assert.ok(fetchText.includes('net.nativeFetch'),
    'Script HTTP requests must bypass Instagram capture hooks');
let realCalls = 0;
let wrappedCalls = 0;
const mockNet = {
    nativeFetch:async()=>{realCalls++;return {
        status:200,ok:true,text:async()=>JSON.stringify({ok:true})
    };}
};
const customWindow = {fetch:async()=>{wrappedCalls++;throw new Error('polluted')}};
const makeFetch = new Function(
    'net','window','state','headers','feedbackRequiredIn',
    'rateLimitCircuitBreak','feedbackCircuitBreak','apiUnhealthyError',
    'summarizeJsonEndpointResponse','summarizeGraphQlErrors',
    'throwIfInstagramStop','sleep','rand',
    fetchText+'\nreturn fetchJson;'
);
const fetchJson = makeFetch(
    mockNet,customWindow,{cancelled:false},()=>({}),
    ()=>false,
    msg=>Object.assign(new Error(msg),{code:'IG_RATE_LIMITED'}),
    msg=>Object.assign(new Error(msg),{code:'IG_FEEDBACK_REQUIRED'}),
    msg=>Object.assign(new Error(msg),{code:'IG_API_UNHEALTHY'}),
    ()=>'',summarize,()=>{},async()=>{},()=>0
);
assert.deepEqual(await fetchJson('https://www.instagram.com/api/graphql'),{ok:true});
assert.equal(realCalls,1);
assert.equal(wrappedCalls,0,'Own request must not be mistaken as native');

const fallback = extract('scanProfileGraphQLFallback');
assert.ok(fallback.includes('native_continuation_unavailable'));
assert.ok(fallback.includes('page_info?.has_next_page === false'));
assert.ok(fallback.includes('seenCursors.has(next)'));
assert.ok(fallback.includes('APP.PROFILE_MAX_SCROLLS'));
assert.ok(source.includes('net.gridNativeContinuationByUser.delete('));

console.log('Native capture provenance, privacy and transport isolation tests passed.');
