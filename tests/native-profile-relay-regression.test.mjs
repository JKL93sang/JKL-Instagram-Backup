import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url),
    'utf8'
);

function extract(name) {
    const p = new RegExp('    (?:async )?function ' + name + '\\(');
    const match = p.exec(source);
    assert.ok(match, 'missing function: ' + name);
    const end = source.indexOf('\n    }\n',match.index);
    assert.ok(end > match.index, 'unterminated function: ' + name);
    return source.slice(match.index,end + 7);
}

const nativeSource = extract('profileNativeCompletionRequest');
const varsSource = extract('profileCompletionVariables');
const fallbackSource = extract('scanProfileGraphQLFallback');
const captureSource = extract('captureGrid');
const relaySource = extract('webRelayGql');

assert.ok(captureSource.includes('requestTargetsCurrentProfile'));
assert.ok(captureSource.includes('net.gridQueryByUser.set'));
assert.ok(captureSource.includes('net.gridNativeContinuationByUser.set'));
assert.ok(captureSource.includes('net.gridNativeInitialByUser.set'));
assert.ok(captureSource.includes('net.gridNativeAuditByUser.set'));
assert.ok(captureSource.includes("meta.endpoint === 'api'"));
assert.ok(captureSource.includes('meta.bodyFields'));
assert.ok(captureSource.includes('meta.relayHeaders'));
assert.ok(relaySource.includes('options.nativeTemplate ||'));
assert.ok(relaySource.includes("native Relay contract missing fb_dtsg"));
assert.ok(fallbackSource.includes('profileNativeCompletionRequest'));
assert.ok(fallbackSource.includes('webRelayGql('));
assert.ok(!fallbackSource.includes('APP.PROFILE_FALLBACK_DOC'));
assert.ok(!fallbackSource.includes('await gql('));
assert.ok(fallbackSource.includes('page_info?.has_next_page === false'));
assert.ok(fallbackSource.includes('native_continuation_unavailable'));
assert.ok(fallbackSource.includes('nativeTemplate:contract.template'));
assert.ok(fallbackSource.includes('contracts.initial'));
assert.ok(fallbackSource.includes('contracts.continuation'));
assert.ok(fallbackSource.includes('contract.variables'));
assert.ok(fallbackSource.includes('contract.docId'));

const store = new Map();
const net = {
    gridQueryByUser:new Map(),
    gridNativeInitialByUser:new Map(),
    gridNativeContinuationByUser:store,
    gridNativeAuditByUser:new Map(),
};
const names = new Set(['PolarisProfilePostsTabContentQuery_connection']);
const helpers = new Function(
    'net','GRID_NAMES','requestTargetsCurrentProfile',
    nativeSource + '\n' + varsSource +
    '\nreturn {profileNativeCompletionRequest,profileCompletionVariables};'
)(net,names,meta=>meta.variables?.username==='sample.account');

assert.equal(
    helpers.profileNativeCompletionRequest('sample.account'),
    null,
    'an absent native contract may not trigger guessed pagination'
);

const entry = {
    docId:'2222222222',
    friendly:'PolarisProfilePostsTabContentQuery_connection',
    endpoint:'api',
    variables:{
        username:'sample.account',
        __relay_internal__pv__PolarisSEOIsCrawlerrelayprovider:false,
        __relay_internal__pv__PolarisIsLoggedInrelayprovider:true,
        data:{count:12,include_relationship_info:true}
    },
    template:{
        body:{fb_dtsg:'PRIVATE-DO-NOT-LOG',doc_id:'2222222222'},
        headers:{'x-fb-friendly-name':'PolarisProfilePostsTabContentQuery_connection'}
    }
};
const continuation = {
    ...entry,
    docId:'3333333333',
    variables:{
        ...entry.variables,
        after:'old-cursor',
        first:12,
        before:null,
        last:null,
        different_provider:'only-on-continuation'
    }
};

net.gridNativeInitialByUser.set('sample.account',entry);
store.set('sample.account',continuation);
assert.equal(
    helpers.profileNativeCompletionRequest('sample.account'),null,
    'initial and continuation templates alone are insufficient evidence'
);

net.gridNativeAuditByUser.set('sample.account',{
    initial:1,continuation:1,cursorLocation:'root'
});
const contracts = helpers.profileNativeCompletionRequest('sample.account');
assert.equal(contracts.initial,entry);
assert.equal(contracts.continuation,continuation);

const firstPage = helpers.profileCompletionVariables(entry.variables);
assert.deepEqual(firstPage,entry.variables);
assert.notEqual(firstPage,entry.variables,'variables must be cloned');
assert.equal(
    helpers.profileCompletionVariables(continuation.variables),
    null,
    'initial request must not replay a native continuation cursor'
);

const next = helpers.profileCompletionVariables(
    continuation.variables,'cursor-2'
);
assert.equal(next.after,'cursor-2');
assert.equal(next.first,12);
assert.equal(next.before,null);
assert.equal(next.last,null);
assert.equal(next.different_provider,'only-on-continuation');
assert.equal(next.__relay_internal__pv__PolarisSEOIsCrawlerrelayprovider,false);
assert.equal(continuation.variables.after,'old-cursor');

const nested = helpers.profileCompletionVariables({
    username:'sample.account',
    data:{after:'old',count:12,first:12,other:'preserved'},
},'new-cursor');
assert.equal(nested.data.after,'new-cursor');
assert.equal(nested.data.first,12);
assert.equal(nested.data.other,'preserved');
assert.ok(!('after' in nested));

const initialOnly = {
    username:'sample.account',data:{count:12},
    __relay_internal__pv__PolarisSEOIsCrawlerrelayprovider:false,
};
assert.deepEqual(
    helpers.profileCompletionVariables(initialOnly),initialOnly
);
assert.equal(
    helpers.profileCompletionVariables(initialOnly,'cursor'),
    null,
    'never introduce an unobserved after variable'
);
assert.equal(
    helpers.profileCompletionVariables({
        username:'sample.account',
        after:null,data:{after:null,count:12}
    },'cursor'),
    null,
    'ambiguous cursor location is never guessed'
);

net.gridNativeInitialByUser.delete('sample.account');
assert.equal(
    helpers.profileNativeCompletionRequest('sample.account'),
    null,
    'missing initial template must keep scan incomplete'
);
net.gridNativeInitialByUser.set('sample.account',entry);
store.set('sample.account',{
    ...continuation,variables:{...continuation.variables,username:'other.account'}
});
assert.equal(
    helpers.profileNativeCompletionRequest('sample.account'),
    null,
    'cross-profile continuation must never be accepted'
);
store.set('sample.account',continuation);
net.gridNativeInitialByUser.set('sample.account',{...entry,docId:'bad'});
assert.equal(helpers.profileNativeCompletionRequest('sample.account'),null);

const fetchSource = extract('fetchJson');
assert.ok(
    fetchSource.includes('Array.isArray(data?.errors)'),
    'JSON GraphQL error responses must not be accepted as a blank grid'
);
assert.ok(
    source.includes('summarizeGraphQlErrors('),
    'Safe GraphQL error category must be exposed without full server message'
);
assert.ok(
    fetchSource.includes('apiUnhealthyError('),
    'GraphQL error should trip the safe stop'
);
const scanSource = extract('scanMainGrid');
assert.ok(
    scanSource.includes('fallback.ended ==='),
    'no fake grid completion from the profile counter'
);
assert.ok(
    source.includes('net.gridQueryByUser.delete(') &&
    source.includes('net.gridNativeContinuationByUser.delete(') &&
    source.includes('net.gridNativeInitialByUser.delete(') &&
    source.includes('net.gridNativeAuditByUser.delete('),
    'native request state must be cleared at the start of each scan'
);
console.log('Native PROFILE Relay pagination regression tests passed.');
