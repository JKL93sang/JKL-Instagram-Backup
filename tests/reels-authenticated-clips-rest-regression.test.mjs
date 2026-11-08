import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const m = new RegExp('    (?:async )?function ' + name + '\\(').exec(src);
    assert.ok(m, 'missing function: ' + name);
    const end = src.indexOf('\n    }\n', m.index);
    assert.ok(end > m.index);
    return src.slice(m.index, end + 7);
}
const media = pk => ({ pk:String(pk), code:'sample', media_type:2, product_type:'clips' });
const page = (ids = [], more = false, cursor = null) => ({
    status:'ok', items:ids.map(pk => ({media:media(pk)})),
    paging_info:{more_available:more,max_id:cursor},
});
const response = (data, status = 200, finalUrl =
    'https://www.instagram.com/api/v1/clips/user/') => ({
    status, responseText:typeof data === 'string' ? data : JSON.stringify(data),
    finalUrl,
});

function scenario(queue, mutate = () => {}) {
    const uid = '45790055326';
    const state = {
        userId:uid, username:'jennnii97', cancelled:false,
        profileInfo:{pk:uid, media_count:1, is_private:false},
        coverage:{reels:false},
        roots:{REEL:new Set()},
        shadow:{reelsEvidence:null},
    };
    mutate(state);
    const requests = [], logs = [], inserted = [];
    const gmRequest = async opts => {
        requests.push(opts);
        const item = queue.shift();
        if (item instanceof Error) throw item;
        if (!item) throw Error('unexpected extra request');
        return item;
    };
    const build = new Function(
        'state', 'APP', 'gmRequest', 'headers',
        'log', 'updateStats', 'addMedia', 'normalizePk',
        'throwIfInstagramStop', 'feedbackRequiredIn',
        'feedbackCircuitBreak', 'sleep', 'rand',
        extract('parseAuthenticatedClipsPage') +
        extract('scanReelsAuthenticatedWithoutTab') +
        '\nreturn {parseAuthenticatedClipsPage,scanReelsAuthenticatedWithoutTab};'
    );
    const api = build(
        state,
        {REEL_REST_PAGE_SIZE:50,REEL_REST_MAX_PAGES:3,PAGE_MIN:0,PAGE_MAX:0,MOBILE_UA:'test'},
        gmRequest, x => x, (msg, severity) => logs.push({msg,severity}),
        () => {}, (raw, type, source) => {
            inserted.push({pk:String(raw.pk),type,source});
            state.roots.REEL.add(String(raw.pk));
            return 1;
        },
        raw => String(raw?.pk || ''),
        e => { if (e?.code === 'IG_RATE_LIMITED') throw e; },
        data => JSON.stringify(data).includes('feedback_required'),
        msg => {throw Object.assign(new Error(msg), {code:'IG_FEEDBACK_REQUIRED'});},
        async () => {}, () => 0,
    );
    return { ...api, state, requests, logs, inserted };
}
{
    const x = scenario([response(page())]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(), true);
    assert.equal(x.state.coverage.reels, true);
    assert.equal(x.requests.length, 1, 'empty feed requires one request');
    assert.equal(x.inserted.length, 0);
    assert.equal(x.requests[0].method, 'POST');
    assert.equal(x.requests[0].url, 'https://www.instagram.com/api/v1/clips/user/');
    const form = new URLSearchParams(x.requests[0].data);
    assert.equal(form.get('target_user_id'), '45790055326');
    assert.equal(form.get('max_id'), '');
    assert.equal(form.get('include_feed_video'), 'true');
    assert.ok(x.logs.some(l => l.msg.includes('verified terminal paging_info')));
}
{
    const x = scenario([
        response(page(['101','102'], true, 'next-1')),
        response(page(['103'], false)),
    ]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(), true);
    assert.deepEqual([...x.state.roots.REEL], ['101','102','103']);
    assert.equal(new URLSearchParams(x.requests[1].data).get('max_id'),'next-1');
    assert.ok(x.inserted.every(x => x.source === 'REEL_AUTHENTICATED_CLIPS_V1' &&
        x.type === 'REEL'));
}
{
    // instagrapi's actual private-API parser relies on paging_info.max_id;
    // more_available may be omitted, but max_id must be explicitly present.
    const x = scenario([response({
        status:'ok',items:[],paging_info:{max_id:null},
    })]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),true);
    assert.equal(x.state.coverage.reels,true);
}
{
    const x = scenario([
        response({status:'ok',items:[{media:media('301')}],
            paging_info:{max_id:'next'}}),
        response({status:'ok',items:[{media:media('302')}],
            paging_info:{max_id:null}}),
    ]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),true);
    assert.equal(x.requests.length,2);
    assert.deepEqual([...x.state.roots.REEL],['301','302']);
}
for (const [name, invalid] of [
    ['status missing', {items:[],paging_info:{more_available:false,max_id:null}}],
    ['items missing', {status:'ok',paging_info:{more_available:false,max_id:null}}],
    ['paging_info missing', {status:'ok',items:[]}],
    ['pagination markers missing', {status:'ok',items:[],paging_info:{}}],
    ['continuation cursor missing', page([],true,null)],
    ['end marker contradiction', page([],false,'cursor')],
    ['media wrapper missing', {status:'ok',items:[{}],paging_info:{more_available:false,max_id:null}}],
    ['invalid media id', {status:'ok',items:[{media:{}}],paging_info:{more_available:false,max_id:null}}],
    ['status failed', {...page(), status:'fail'}],
]) {
    const x = scenario([response(invalid)]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(), false,name);
    assert.equal(x.state.coverage.reels,false,name);
}
{
    const x = scenario([response('<html>redirect</html>')]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),false);
    assert.ok(x.logs.some(l => l.msg.includes('non-JSON')));
}
{
    const x = scenario([response(page(),200,'https://www.instagram.com/')]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),false);
}
{
    const x = scenario([response(page(),403)]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),false);
}
{
    const x = scenario([response(page())],state => {state.profileInfo.pk='other';});
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),false);
    assert.equal(x.requests.length,0,'wrong target cannot issue a network call');
}
{
    const x = scenario([response(page())],state => {
        state.profileInfo.has_any_clips=true;
    });
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),false,
        'empty REST feed conflicts with positive clip metadata');
}
{
    const x = scenario([response(page())],state => {
        state.roots.REEL.add('previously-known');
    });
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),false,
        'empty REST feed cannot hide a Reel already known from another surface');
}
{
    const x = scenario([
        response(page(['201'],true,'same-cursor')),
        response(page(['202'],true,'same-cursor')),
    ]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),false);
    assert.equal(x.requests.length,2,'repeated cursor stops pagination');
}
{
    const x = scenario([response(page(['401'],true,'next'))]);
    assert.equal(await x.scanReelsAuthenticatedWithoutTab(),false);
    assert.equal(x.state.coverage.reels,false,
        'a subsequent request failure never counts as completed pagination');
}
{
    const e=Object.assign(Error('rate'),{code:'IG_RATE_LIMITED'});
    const x=scenario([e]);
    await assert.rejects(x.scanReelsAuthenticatedWithoutTab(),/rate/);
    assert.equal(x.state.coverage.reels,false);
    assert.equal(x.requests.length,1,'no automatic retry after a rate limit');
}
assert.ok(!extract('parseAuthenticatedClipsPage').includes('latest_reel_media'),
    'Story timestamps must never influence clips pagination');
assert.ok(!extract('explicitEmptyReelsProof').includes('latest_reel_media'),
    'Story timestamps must not be mistaken for a Reel');
console.log('Authenticated clips REST: empty, multiple pages, malformed, redirect, failed, repeat, conflict and 429 guards passed.');
