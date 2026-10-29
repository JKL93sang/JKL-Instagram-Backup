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
assert.ok(fallbackSource.includes('native_contract_unavailable'));
assert.ok(fallbackSource.includes('native.template'));
assert.ok(fallbackSource.includes('native.variables'));

const store = new Map();
const net = {gridQueryByUser:store};
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
assert.equal(entry.variables.after,'old-cursor','source must not mutate');

store.set('other.account',{
    ...entry,
    variables:{...entry.variables,username:'other.account'},
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
assert.ok(!('after' in nested));
const docBad = {...entry,docId:'bad'};
store.set('bad.account',docBad);
assert.equal(helpers.profileNativeCompletionRequest('bad.account'),null);

const fetchSource = extract('fetchJson');
assert.ok(
    fetchSource.includes('Array.isArray(data?.errors)'),
    'JSON GraphQL error responses must not be accepted as a blank grid'
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
    source.includes('net.gridQueryByUser.delete('),
    'native request state must be cleared at the start of each scan'
);
console.log('Native PROFILE Relay pagination regression tests passed.');
