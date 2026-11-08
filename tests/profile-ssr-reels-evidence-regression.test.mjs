import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const re = new RegExp('    (?:async )?function ' + name + '\\(');
    const m = re.exec(source);
    assert.ok(m, 'missing function: ' + name);
    const end = source.indexOf('\n    }\n', m.index);
    assert.ok(end > m.index, 'function end missing: ' + name);
    return source.slice(m.index, end + 7);
}

const userId = '45790055326';
const username = 'jennnii97';
const baseUser = () => ({
    pk: userId,
    username,
    polaris_ordered_timeline_connection: {
        edges: [{
            node: { pk:'881123', code:'DkExample', product_type:'feed' },
        }],
        page_info: { has_next_page: false, end_cursor: null },
    },
});

class FakeDOMParser {
    parseFromString(html) {
        return {
            querySelectorAll(selector) {
                assert.equal(selector, 'script[type="application/json"]');
                return [{ textContent: html }];
            },
        };
    }
}
function walkObject(data, visit) {
    if (!data || typeof data !== 'object') return;
    visit(data);
    for (const val of Object.values(data)) walkObject(val, visit);
}

const state = {
    userId,
    username,
    expected: 1,
    profileInfo: { pk:userId, media_count:1, is_private:false },
    exclusive: { known:true, hasExclusiveFeedContent:false },
    coverage: {
        profileGrid:true, publicShadow:true,
        connectedHidden:true, ownedHydration:true, reels:false,
    },
    hidden: { candidates:0, recovered:0, previewOnly:0, failed:0 },
    roots: { POST:new Set(['881123']), REEL:new Set() },
    shadow: {
        applicable:true, profileId:userId, pageInfoEnded:true,
        rootIds:new Set(['881123']),
        postIds:new Set(['881123']), reelIds:new Set(),
        reelsEvidence:null,
    },
};
const net = { reelsByUserId:new Map([[userId,new Map()]]) };
const logs = [];
const api = new Function(
    'state', 'net', 'DOMParser', 'walkObject',
    'scanSelected', 'pathNorm', 'location', 'findAnchor', 'log',
    extract('publicSSRReelsEvidence') +
    extract('parseAnonymousProfileHTML') +
    extract('verifiedPublicGridPrimaryProof') +
    extract('explicitEmptyReelsProof') +
    extract('reconcileEmptyReelsCoverage') +
    '\nreturn { publicSSRReelsEvidence, parseAnonymousProfileHTML, ' +
    'verifiedPublicGridPrimaryProof, explicitEmptyReelsProof, ' +
    'reconcileEmptyReelsCoverage };'
)(
    state, net, FakeDOMParser, walkObject,
    key => key === 'post' || key === 'reel',
    s => String(s).replace(/\/+$/, ''),
    { pathname:'/jennnii97/' },
    () => null,
    (...args) => logs.push(args)
);
const parse = (...users) => api.parseAnonymousProfileHTML(
    JSON.stringify({ records:users.map(x => ({ xig_user_by_username:x })) })
);
const withOne = changes => ({ ...baseUser(), ...changes });

// This matches the current real browser failure: authenticated USER INFO
// omits ALL three clip fields, yet PUBLIC SSR has a valid profile timeline.
assert.equal(state.profileInfo.total_clips_count, undefined);
const falseSSR = parse(withOne({ has_any_clips:false }));
assert.equal(falseSSR.pageInfo.has_next_page, false);
assert.equal(falseSSR.edges.length, 1);
assert.equal(falseSSR.reelsEvidence.profileId, userId);
assert.equal(falseSSR.reelsEvidence.username, username);
assert.equal(falseSSR.reelsEvidence.hasAnyClips, false);
assert.equal(falseSSR.reelsEvidence.totalClipsCount, null);
assert.equal(falseSSR.reelsEvidence.consistent, true);
state.shadow.reelsEvidence = falseSSR.reelsEvidence;
assert.equal(api.verifiedPublicGridPrimaryProof().verified, true);
assert.deepEqual(api.explicitEmptyReelsProof(), {
    verified:true,
    reason:'explicit_zero_clips_and_verified_public_grid_end',
    source:'public_ssr_has_any_clips_false',
});
api.reconcileEmptyReelsCoverage();
assert.equal(state.coverage.reels, true);
assert.ok(logs.some(a => String(a[0]).includes('public_ssr_has_any_clips_false')));

function reject(label, changes, mutate = () => {}) {
    const x = parse(withOne(changes));
    state.shadow.reelsEvidence = x.reelsEvidence;
    state.coverage.reels = false;
    mutate();
    const proof = api.explicitEmptyReelsProof();
    assert.equal(proof.verified, false, label);
    api.reconcileEmptyReelsCoverage();
    assert.equal(state.coverage.reels, false, label + ': no false completion');
}
reject('field omitted entirely', {});
{
    const storyOnly = parse(withOne({ latest_reel_media:1792002021 }));
    state.shadow.reelsEvidence = storyOnly.reelsEvidence;
    assert.equal(storyOnly.reelsEvidence.latestStoryTimestampPresent, true);
    assert.deepEqual(api.explicitEmptyReelsProof(), {
        verified:false, reason:'clips_absence_not_explicitly_reported',
    }, 'a Story timestamp alone proves neither Reels presence nor absence');
}

reject('true explicitly indicates reels', { has_any_clips:true });
reject('positive server clips count', { total_clips_count:3 });
{
    const x = parse(withOne({
        has_any_clips:false, latest_reel_media:1792002021,
    }));
    state.shadow.reelsEvidence = x.reelsEvidence;
    assert.equal(api.explicitEmptyReelsProof().verified, true,
        'Story latest_reel_media timestamp never disproves zero clips');
}
reject('SSR flag and counter disagree', {
    has_any_clips:false, total_clips_count:2,
});
reject('SSR flag and zero count disagree', {
    has_any_clips:true, total_clips_count:0,
});
reject('invalid clips count cannot prove zero', { total_clips_count:'0.0' });
reject('invalid count cannot be combined with a false flag', {
    has_any_clips:false, total_clips_count:'invalid',
});
reject('invalid boolean value cannot be combined with zero count', {
    has_any_clips:'false', total_clips_count:0,
});
reject('unrepresentable integer count is not zero', {
    total_clips_count:'999999999999999999999',
});
reject('nonzero reel roots contradict flag', { has_any_clips:false }, () => {
    state.roots.REEL.add('999');
});
state.roots.REEL.clear();

const exactZero = parse(withOne({ total_clips_count:0 }));
assert.equal(exactZero.reelsEvidence.totalClipsCount, 0);
assert.equal(exactZero.reelsEvidence.consistent, true);
state.shadow.reelsEvidence = exactZero.reelsEvidence;
assert.equal(api.explicitEmptyReelsProof().source, 'public_ssr_total_clips_count');

const duplicatedConflict = parse(
    withOne({ has_any_clips:false }),
    withOne({ has_any_clips:true })
);
assert.equal(duplicatedConflict.reelsEvidence.consistent, false);
state.shadow.reelsEvidence = duplicatedConflict.reelsEvidence;
assert.equal(api.explicitEmptyReelsProof().verified, false,
    'two contradictory SSR copies cannot grant completion');

const otherUsername = parse(withOne({ username:'not-scanned-user',
    has_any_clips:false }));
assert.equal(otherUsername.reelsEvidence, null,
    'same id but wrong visible username is not valid explicit absence evidence');
state.shadow.reelsEvidence = otherUsername.reelsEvidence;
assert.equal(api.explicitEmptyReelsProof().verified, false);
assert.throws(
    () => parse({ ...baseUser(), pk:'another-account', has_any_clips:false }),
    /SSR public timeline not found/,
    'cross-account SSR data must not be accepted'
);

// API's independent real source can still prove zero when SSR is missing.
state.profileInfo.total_clips_count = 0;
state.shadow.reelsEvidence = null;
assert.equal(api.explicitEmptyReelsProof().source,
    'authenticated_user_info_total_clips_count');
state.shadow.reelsEvidence = parse(withOne({has_any_clips:true})).reelsEvidence;
assert.equal(api.explicitEmptyReelsProof().verified, false,
    'positive SSR metadata blocks a contradictory authenticated count');
state.profileInfo.total_clips_count = undefined;

// Empty-sentinel values in REST and SSR are not evidence that clips EXIST.
// They also cannot, by themselves, prove that an entire Reels feed is empty.
for (const sentinel of [0, '0', false, '']) {
    state.profileInfo.latest_reel_media = sentinel;
    state.shadow.reelsEvidence = null;
    assert.deepEqual(api.explicitEmptyReelsProof(), {
        verified:false, reason:'clips_absence_not_explicitly_reported',
    }, 'placeholder latest_reel_media without explicit zero cannot prove an empty feed');
    state.shadow.reelsEvidence = falseSSR.reelsEvidence;
    assert.equal(api.explicitEmptyReelsProof().verified, true,
        'explicit SSR false must not be contradicted by empty latest_reel_media sentinel');
    const ssr = parse(withOne({
        has_any_clips:false, latest_reel_media:sentinel,
    })).reelsEvidence;
    assert.equal(ssr.latestStoryTimestampPresent, false,
        'empty Story timestamp sentinel remains independently classified');
    assert.equal(ssr.consistent, true);
}
for (const storyMarker of [{ pk:'123' }, 123, '123']) {
    state.profileInfo.latest_reel_media = storyMarker;
    state.shadow.reelsEvidence = falseSSR.reelsEvidence;
    assert.equal(api.explicitEmptyReelsProof().verified, true,
        'Story media marker never indicates a short-video Reel');
}
delete state.profileInfo.latest_reel_media;
state.shadow.reelsEvidence = null;

// Provenance must be reset before each new scan, and assigned only
// after a completed public SSR timeline, never from another profile.
assert.ok(extract('resetCoverage').includes('state.shadow.reelsEvidence = null;'));
assert.ok(extract('scanPublicShadow').includes('state.shadow.reelsEvidence = null;'));
assert.ok(extract('scanPublicShadow').includes('state.shadow.reelsEvidence = initial.reelsEvidence'));
assert.ok(extract('scanPublicShadow').includes("state.shadow.profileId = String(state.userId || '')"));

console.log(
    'Real SSR xig_user profile flags: explicit false/zero accepted, ' +
    'unknown/contradictory/other-profile values blocked and reset.'
);
