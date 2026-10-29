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
assert.ok(fallbackSource.includes('native.template'));
assert.ok(fallbackSource.includes('native.variables'));

const store = new Map();
const net = {
    gridQueryByUser:new Map(),
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
    docId:'1234567890',
    friendly:'PolarisProfilePostsTabContentQuery_connection',
    endpoint:'api',
    variables:{
        username:'sample.account',
        __relay_internal__pv__PolarisSEOIsCrawlerrelayprovider:false,
        __relay_internal__pv__PolarisIsLoggedInrelayprovider:true,
        data:{count:12,include_relationship_info:true},
        after:'old-cursor',first:12,
    },
    template:{
        body:{fb_dtsg:'sensitive-not-for-logs',doc_id:'1234567890'},
        headers:{'x-fb-friendly-name':'PolarisProfilePostsTabContentQuery_connection'},
    },
};
store.set('sample.account',entry);
assert.equal(
    helpers.profileNativeCompletionRequest('sample.account'),
    null,
    'continuation contract without native response is untrusted'
);
net.gridNativeAuditByUser.set('sample.account',{
    initial:1,continuation:1,cursorLocation:'root'
});
assert.equal(
    helpers.profileNativeCompletionRequest('sample.account'),
    entry
);
const initial = helpers.profileCompletionVariables(entry.variables);
assert.equal(initial.after,null);
assert.equal(initial.first,12);
assert.equal(
    initial.__relay_internal__pv__PolarisSEOIsCrawlerrelayprovider,
    false,
    'the browser-observed relay provider must be preserved'
);
assert.equal(initial.data.count,12);
const next = helpers.profileCompletionVariables(entry.variables,'cursor-2');
assert.equal(next.after,'cursor-2');
assert.equal(next.first,12);
assert.equal(next.before,null);
assert.equal(next.last,null);
assert.equal(entry.variables.after,'old-cursor','source must not mutate');

store.set('other.account',{
    ...entry,
    variables:{...entry.variables,username:'other.account'},
});
net.gridNativeAuditByUser.set('other.account',{
    initial:1,continuation:1,cursorLocation:'root'
});
assert.equal(
    helpers.profileNativeCompletionRequest('other.account'),
    null,
    'a query unrelated to the active target must not be replayed'
);

const nested = helpers.profileCompletionVariables({
    username:'sample.account',
    data:{after:'old',count:12},
},'new-cursor');
assert.equal(nested.data.after,'new-cursor');
assert.equal(nested.data.first,12);
assert.equal(nested.data.before,null);
assert.equal(nested.data.last,null);
assert.ok(!('after' in nested));

/* This is the actual failure pattern in v1.5.60:
 * initial profile query has only data.count=12 and no
 * top-level connection args; page 1 succeeds, page 2
 * cannot be sent without first/before/last.
 */
const initialOnly = {
    username:'sample.account',
    data:{count:12,include_relationship_info:true},
    __relay_internal__pv__PolarisSEOIsCrawlerrelayprovider:false,
};
const firstPage = helpers.profileCompletionVariables(initialOnly);
assert.ok(!('first' in firstPage));
assert.ok(!('after' in firstPage));
const page2 = helpers.profileCompletionVariables(initialOnly,'opaque-page-2');
assert.equal(page2,null,
    'never invent a cursor field absent from native variables'
);
assert.ok(!('after' in initialOnly));
assert.equal(initialOnly.data.count,12);

/* No native page size => no speculative pagination request. */
assert.equal(
    helpers.profileCompletionVariables(
        {username:'sample.account'},'opaque-page-2'
    ),
    null
);
const implausible = helpers.profileCompletionVariables({
    username:'sample.account',data:{count:10000}
},'opaque-page-2');
assert.equal(implausible,null);

const docBad = {...entry,docId:'bad'};
store.set('bad.account',docBad);
net.gridNativeAuditByUser.set('bad.account',{
    initial:1,continuation:1,cursorLocation:'root'
});
assert.equal(helpers.profileNativeCompletionRequest('bad.account'),null);

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
    source.includes('net.gridNativeAuditByUser.delete('),
    'native request state must be cleared at the start of each scan'
);
console.log('Native PROFILE Relay pagination regression tests passed.');
