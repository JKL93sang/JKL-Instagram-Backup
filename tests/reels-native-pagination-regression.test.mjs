import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    let p = src.indexOf('    function ' + name + '(');
    if (p < 0) p = src.indexOf('    async function ' + name + '(');
    assert.ok(p >= 0, 'function missing: ' + name);
    const end = src.indexOf('\n    }\n', p);
    assert.ok(end > p, 'function closing brace missing: ' + name);
    return src.slice(p, end + 7);
}

function harness() {
    const state = {
        userId:'42', cancelled:false,
        roots:{ REEL:new Set(['m1','m2']) },
    };
    const net = {
        reelsByUserId:new Map(), reelPageInfo:new Map(),
        reelNativeAuditByUserId:new Map(),
        reelNativeInitialByUserId:new Map(),
        reelNativeContinuationByUserId:new Map(),
    };
    const calls = [];
    const events = [];
    let responses = [];
    const fn = new Function(
        'net','state','REEL_NAMES','requestTargetsCurrentProfile','reelUserId',
        'reelConn','edgeNode','normalizePk','webRelayGql','log','updateStats',
        'APP','addMedia','sleep','rand','throwIfInstagramStop','REEL_CONNECTION_KEY',
        [
            extract('reelNativeCursorField'),
            extract('captureReels'),
            extract('verifiedReelNativeContinuation'),
            extract('reelNativeContinuationVariables'),
            extract('scanReelsNativeCompletion'),
        ].join('\n') +
        '\nreturn { reelNativeCursorField, captureReels, ' +
        'verifiedReelNativeContinuation, reelNativeContinuationVariables, ' +
        'scanReelsNativeCompletion };'
    );
    const impl = fn(
        net, state,
        new Set(['PolarisProfileReelsTabContentQuery']),
        meta => String(meta?.variables?.data?.target_user_id || '') === state.userId,
        meta => String(meta?.variables?.data?.target_user_id || ''),
        d => d?.data?.connection || null,
        e => e.node,
        n => n.id,
        async (doc,vars,name,options) => {
            calls.push({doc,vars,name,options});
            if (!responses.length) throw Error('unexpected network request');
            return responses.shift();
        },
        (...args) => events.push(args),
        () => {},
        { REEL_MAX_SCROLLS:5, PAGE_MIN:0, PAGE_MAX:0 },
        (media) => state.roots.REEL.add(media.id),
        async () => {},
        () => 0,
        e => { if (e.code?.startsWith('IG_')) throw e; },
        'reels_media_connection'
    );
    const meta = (cursor='',user='42',docId='123456') => ({
        friendly:'PolarisProfileReelsTabContentQuery',
        docId,endpoint:'api',
        variables:{data:{
            target_user_id:user,page_size:12,
            ...(cursor ? {max_id:cursor} : {}),
        }},
        bodyFields:{fb_dtsg:'REDACTED_TEST_TOKEN'},
        relayHeaders:{'x-root-field-name':'reels_media_connection'},
    });
    const page = (ids,hasNext,endCursor='') => ({
        data:{connection:{
            edges:ids.map(id=>({node:{id}})),
            page_info:{has_next_page:hasNext,end_cursor:endCursor},
        }},
    });
    return {impl,net,state,calls,events,meta,page,
        setResponses:list=>{responses=list.slice();}};
}

const verified = harness();
verified.impl.captureReels(
    verified.page(['m1'],true,'first-cursor'),
    verified.meta()
);
verified.impl.captureReels(
    verified.page(['m2'],true,'last-native-cursor'),
    verified.meta('first-cursor')
);
assert.equal(verified.net.reelNativeAuditByUserId.get('42').initial,1);
assert.equal(verified.net.reelNativeAuditByUserId.get('42').continuation,1);
assert.equal(verified.impl.verifiedReelNativeContinuation('42').cursorPath,'data.max_id');
assert.equal(verified.impl.reelNativeContinuationVariables(
    verified.impl.verifiedReelNativeContinuation('42'),
    'new-opaque-cursor'
).data.max_id,'new-opaque-cursor');

verified.setResponses([
    verified.page(['m3'],true,'following-cursor'),
    verified.page(['m4'],false,''),
]);
assert.equal(await verified.impl.scanReelsNativeCompletion({reason:'bottom_stagnant_has_next'}),true);
assert.equal(verified.calls.length,2);
assert.equal(verified.calls[0].doc,'123456');
assert.equal(verified.calls[0].vars.data.max_id,'last-native-cursor');
assert.equal(verified.calls[1].vars.data.max_id,'following-cursor');
assert.equal(verified.state.roots.REEL.size,4);

const missing = harness();
missing.impl.captureReels(missing.page(['m1'],true,'pending'),missing.meta());
assert.equal(await missing.impl.scanReelsNativeCompletion({reason:'bottom_stagnant_has_next'}),false);
assert.equal(missing.calls.length,0,
    'without an authenticated native continuation schema no speculative GraphQL is sent');
assert.ok(missing.events.some(e=>String(e[0]).includes('INCOMPLETE')));

const ended = harness();
ended.impl.captureReels(ended.page(['m1'],false,''),ended.meta());
assert.equal(await ended.impl.scanReelsNativeCompletion({reason:'page_info_end'}),true);
assert.equal(ended.calls.length,0,'verified native end should not require static GraphQL');

const foreign = harness();
foreign.impl.captureReels(foreign.page(['foreign'],false,''),foreign.meta('','99'));
assert.equal(foreign.net.reelsByUserId.size,0,'foreign root must not be captured');
assert.equal(foreign.net.reelNativeAuditByUserId.size,0);
assert.equal(await foreign.impl.scanReelsNativeCompletion({reason:'native_navigation_failed'}),false);
assert.equal(foreign.calls.length,0);

const malformed = harness();
malformed.impl.captureReels(malformed.page(['m1'],true,'cursor'),malformed.meta());
malformed.impl.captureReels(malformed.page(['m2'],true,'cursor2'),malformed.meta('cursor','42','bad-doc'));
assert.equal(malformed.impl.verifiedReelNativeContinuation('42'),null);
assert.equal(await malformed.impl.scanReelsNativeCompletion({reason:'bottom_stagnant_has_next'}),false);
assert.equal(malformed.calls.length,0);

const loop = harness();
loop.impl.captureReels(loop.page(['m1'],true,'cursor'),loop.meta());
loop.impl.captureReels(loop.page(['m2'],true,'cursor2'),loop.meta('cursor'));
loop.setResponses([loop.page(['m3'],true,'cursor2')]);
assert.equal(await loop.impl.scanReelsNativeCompletion({reason:'bottom_stagnant_has_next'}),false);
assert.equal(loop.calls.length,1,'cursor repetition must stop without infinite calls');

assert.ok(!src.includes('async function scanReelsFallback('));
assert.ok(!src.includes('await gql(\n                    APP.REEL_FALLBACK_DOC'));
console.log('Native REELS verified pagination, identity, cursor and no-guess regressions passed.');
