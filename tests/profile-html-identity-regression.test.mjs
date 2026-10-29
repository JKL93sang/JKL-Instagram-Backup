import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url),
    'utf8'
);

function extract(name) {
    const pattern = new RegExp(
        '    (?:async )?function ' + name + '\\('
    );
    const match = pattern.exec(source);
    assert.ok(match, 'Missing ' + name);
    const end = source.indexOf('\n    }\n', match.index);
    assert.ok(end > match.index, 'Unterminated ' + name);
    return source.slice(match.index, end + 7);
}

const cleanUser = value =>
    String(value || '').trim()
        .replace(/^@/, '')
        .replace(/[^A-Za-z0-9._]/g, '');

const parse = new Function(
    'location', 'cleanUser',
    extract('profileMetadataFromHtml') +
    '\nreturn profileMetadataFromHtml;'
)(
    {origin:'https://www.instagram.com'},
    cleanUser
);

const username = 'sample.account';
const pageUrl = 'https://www.instagram.com/sample.account/';
const profileId = '123456789012345678';
const ownerMeta =
    '<meta name="instapp:owner_user_id" content="' +
    profileId + '">';
const pageScript =
    '<script>{"page_id":"profilePage_' +
    profileId + '"}</script>';
const profileScript =
    '<script>{"profile_id":"' + profileId + '"}</script>';

for (const html of [ownerMeta, pageScript, profileScript]) {
    assert.equal(
        parse(html, username, pageUrl)?.id,
        profileId,
        'A profile-specific ID should resolve'
    );
}
assert.equal(
    parse(profileScript, username,
        'https://www.instagram.com/accounts/login/'),
    null,
    'Login redirect must not be confused with the profile'
);
assert.equal(
    parse(profileScript, username,
        'https://www.instagram.com/other.profile/'),
    null,
    'Another profile must never be used'
);
assert.equal(
    parse(
        '<meta property="og:url" content="https://www.instagram.com/other.profile/">' +
        profileScript,
        username, pageUrl
    ),
    null,
    'Mismatched canonical profile must not be trusted'
);
assert.equal(
    parse('<script>{"id":"'+profileId+'"}</script>',
        username, pageUrl),
    null,
    'Generic user IDs must not be accepted'
);
assert.equal(
    parse(pageScript,username,
        'https://example.org/sample.account/'),
    null,
    'Foreign origin must not be trusted'
);

const resolver = extract('resolveProfile');
assert.ok(
    resolver.indexOf('fetchProfilePageMetadata') <
    resolver.indexOf('web/search/topsearch'),
    'HTML identity lookup must happen before optional search'
);
assert.ok(
    !resolver.includes('/api/v1/feed/user/'),
    'Known-redirecting legacy feed endpoint must not return'
);
const requestSource = extract('fetchProfilePageMetadata');
assert.ok(
    !requestSource.includes('while (') &&
    !requestSource.includes('setTimeout'),
    'Profile fallback must not retry aggressively'
);
assert.ok(
    requestSource.includes('rateLimitCircuitBreak') &&
    requestSource.includes('feedbackCircuitBreak'),
    'Rate limits and feedback stop conditions must remain'
);
assert.ok(
    requestSource.includes('IG_PROFILE_REDIRECT') &&
    requestSource.includes('IG_PROFILE_ACCESS'),
    'Login redirect and access guards must be explicit'
);

const createFetcher = fetchImpl => new Function(
    'fetch','location','cleanUser','profileMetadataFromHtml',
    'rateLimitCircuitBreak','feedbackCircuitBreak',
    'feedbackRequiredIn',
    requestSource + '\nreturn fetchProfilePageMetadata;'
)(
    fetchImpl,
    {origin:'https://www.instagram.com'},
    cleanUser,parse,
    reason=>Object.assign(new Error(reason),{code:'IG_RATE_LIMITED'}),
    reason=>Object.assign(new Error(reason),{code:'IG_FEEDBACK_REQUIRED'}),
    value=>String(value).includes('feedback_required')
);

let calls = 0;
const fetchOk = createFetcher(async (url,options)=>{
    calls++;
    assert.equal(url,pageUrl);
    assert.equal(options.credentials,'include');
    assert.equal(options.redirect,'follow');
    return {
        ok:true,status:200,url:pageUrl,
        text:async()=>ownerMeta
    };
});
assert.equal(
    (await fetchOk(username)).id,profileId
);
assert.equal(calls,1,'Only one HTML request is allowed');

const limited = createFetcher(async()=>({
    ok:false,status:429,url:pageUrl,
    text:async()=>'<html>Too many requests</html>'
}));
await assert.rejects(
    limited(username),
    error=>error.code==='IG_RATE_LIMITED',
    '429 must stop immediately'
);

const redirected = createFetcher(async()=>({
    ok:true,status:200,
    url:'https://www.instagram.com/accounts/login/',
    text:async()=>profileScript
}));
await assert.rejects(
    redirected(username),
    error=>error.code==='IG_PROFILE_REDIRECT',
    'Redirect to login must stop without resolving an ID'
);

const gated = createFetcher(async()=>({
    ok:false,status:403,url:pageUrl,
    text:async()=>'<html>Restricted</html>'
}));
await assert.rejects(
    gated(username),
    error=>error.code==='IG_PROFILE_ACCESS',
    '403 must not silently retry another endpoint'
);

const metadataVersion =
    source.match(/\/\/ @version\s+([0-9.]+)/)?.[1];
const appVersion =
    source.match(/VERSION:\s*'([0-9.]+)'/)?.[1];
assert.equal(metadataVersion,'1.5.60');
assert.equal(appVersion,metadataVersion);

console.log('Profile HTML identity fallback regression tests passed.');
