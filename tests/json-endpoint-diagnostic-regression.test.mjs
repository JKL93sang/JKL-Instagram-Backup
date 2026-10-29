import fs from 'node:fs';
import assert from 'node:assert/strict';

const script = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url),
    'utf8'
);

const start = script.indexOf(
    '    function summarizeJsonEndpointResponse('
);
const end = script.indexOf(
    '    async function fetchJson(', start
);
assert.ok(start !== -1 && end > start);
const code = script.slice(start,end);

const summarize = new Function(
    'URL','location',
    code + '\nreturn summarizeJsonEndpointResponse;'
)(URL,{origin:'https://www.instagram.com'});

const response = (contentType,url,redirected=false)=>({
    url,
    redirected,
    headers:{
        get:name=>name.toLowerCase()==='content-type'
            ? contentType : null
    }
});
const html = '<!DOCTYPE html><html><body>login</body></html>';
const auth = summarize(
    response('text/html; charset=utf-8',
        'https://www.instagram.com/accounts/login/?next=/target',
        true),
    html
);
assert.ok(auth.includes('type=text/html'));
assert.ok(auth.includes('body=html'));
assert.ok(auth.includes('destination=login'));
assert.ok(auth.includes('redirected=yes'));
assert.ok(!auth.includes('next='));
assert.ok(!auth.includes('login</body>'));
const graphql = summarize(
    response('text/html','https://www.instagram.com/graphql/query'),
    html
);
assert.ok(graphql.includes('destination=graphql'));
assert.ok(graphql.includes('body=html'));

const missing = summarize(
    response('', 'https://www.instagram.com/',false),
    ''
);
assert.ok(missing.includes('body=empty'));
assert.ok(missing.includes('destination=home'));

const content = script.slice(
    script.indexOf('    async function fetchJson('),
    script.indexOf('    async function gql(')
);
assert.ok(
    content.includes('summarizeJsonEndpointResponse(r, text)'),
    'fetchJson must preserve the non-JSON stop while enriching diagnostics'
);
assert.ok(
    content.includes('apiUnhealthyError('),
    'API unhealthy safety circuit is missing'
);
const fallback = script.slice(
    script.indexOf('    async function scanProfileGraphQLFallback('),
    script.indexOf('    async function scanMainGrid(')
);
assert.ok(
    fallback.includes('native_doc_differs='),
    'Captured native GraphQL doc ID must be logged safely'
);
assert.ok(
    fallback.includes('profileNativeCompletionRequest') &&
    fallback.includes('page_info?.has_next_page === false'),
    'The native contract must be required and completion must keep the explicit end proof'
);

console.log('Safe GraphQL response diagnostics regression tests passed.');
