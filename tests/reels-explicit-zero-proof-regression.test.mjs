import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const match = new RegExp('    (?:async )?function ' + name + '\\(').exec(src);
    assert.ok(match, 'missing function: ' + name);
    const end = src.indexOf('\n    }\n', match.index);
    assert.ok(end >= match.index, 'missing function boundary: ' + name);
    return src.slice(match.index, end + 7);
}
function fixture() {
    const userId = '45790055326';
    const postId = '777001';
    const state = {
        userId, username: 'jennnii97', expected: 1,
        profileInfo: {
            pk: userId, media_count: 1, total_clips_count: 0,
            is_private: false, has_clips: false,
        },
        exclusive: { known: true, hasExclusiveFeedContent: false },
        shadow: {
            applicable: true, pageInfoEnded: true,
            profileId: userId, rootIds: new Set([postId]),
            postIds: new Set([postId]), reelIds: new Set(),
        },
        coverage: {
            publicShadow: true, profileGrid: true, reels: false,
            connectedHidden: true, ownedHydration: true,
        },
        roots: { POST: new Set([postId]), REEL: new Set() },
        hidden: { candidates: 0, recovered: 0, previewOnly: 0, failed: 0 },
    };
    const net = { reelsByUserId: new Map([[userId, new Map()]]) };
    let reelTab = false;
    let isReelPath = false;
    const logs = [];
    const api = new Function(
        'state', 'net', 'location', 'scanSelected',
        'pathNorm', 'findAnchor', 'log',
        extract('verifiedPublicGridPrimaryProof') +
        extract('explicitEmptyReelsProof') +
        extract('reconcileEmptyReelsCoverage') +
        '\nreturn { verifiedPublicGridPrimaryProof, ' +
        'explicitEmptyReelsProof, reconcileEmptyReelsCoverage };'
    )(
        state, net,
        { get pathname() { return isReelPath ? '/jennnii97/reels/' : '/jennnii97/'; } },
        type => type === 'post' || type === 'reel',
        path => path.replace(/\/+$/, ''),
        () => reelTab,
        (...a) => logs.push(a),
    );
    return {
        state, net, logs, ...api,
        showTab(value) { reelTab = value; },
        showReelsPath(value) { isReelPath = value; },
    };
}
const f = fixture();
assert.equal(f.explicitEmptyReelsProof().verified, true);
assert.equal(f.verifiedPublicGridPrimaryProof().verified, true);
f.reconcileEmptyReelsCoverage();
assert.equal(f.state.coverage.profileGrid, true);
assert.equal(f.state.coverage.reels, true,
    'an explicit zero target count corroborated by the public source proves an empty tab');
assert.ok(f.logs.some(x => x[0].includes('REELS independently proven EMPTY')));
const missingCount = fixture();
delete missingCount.state.profileInfo.total_clips_count;
assert.equal(missingCount.explicitEmptyReelsProof().verified, false);
missingCount.reconcileEmptyReelsCoverage();
assert.equal(missingCount.state.coverage.reels, false);
assert.ok(missingCount.logs.some(x => x[0].includes('Keeping REELS INCOMPLETE')));

function reject(label, mutate) {
    const x = fixture();
    mutate(x);
    assert.equal(x.explicitEmptyReelsProof().verified, false, label);
    x.reconcileEmptyReelsCoverage();
    assert.equal(x.state.coverage.reels, false, label + ' must stay incomplete');
}
reject('positive Reels count', x => { x.state.profileInfo.total_clips_count = 1; });
reject('metadata count is null', x => { x.state.profileInfo.total_clips_count = null; });
reject('unverified string zero format', x => { x.state.profileInfo.total_clips_count = '0.0'; });
reject('negative count', x => { x.state.profileInfo.total_clips_count = -1; });
reject('profile has clips despite zero count', x => { x.state.profileInfo.has_clips = true; });
reject('profile has any clips despite zero count', x => { x.state.profileInfo.has_any_clips = true; });
{
    const x = fixture();
    x.state.profileInfo.latest_reel_media = 1792002021;
    assert.equal(x.explicitEmptyReelsProof().verified, true,
        'latest_reel_media is a Story timestamp, not a short-video Reel');
}
reject('other profile ID', x => { x.state.profileInfo.pk = 'other'; });
reject('unknown profile ID', x => { x.state.profileInfo.pk = ''; });
reject('public server pagination unknown', x => { x.state.shadow.pageInfoEnded = false; });
reject('non-identical public SSR target', x => { x.state.shadow.profileId = 'other'; });
reject('private account', x => { x.state.profileInfo.is_private = true; });
reject('exclusive content', x => { x.state.exclusive.hasExclusiveFeedContent = true; });
reject('public profile media_count changed', x => { x.state.profileInfo.media_count = 2; });
reject('public main grid incomplete', x => { x.state.coverage.profileGrid = false; });
reject('hidden candidates not reconciled', x => { x.state.hidden.candidates = 1; });
reject('hidden coverage unknown', x => { x.state.coverage.connectedHidden = false; });
reject('owned hydration incomplete', x => { x.state.coverage.ownedHydration = false; });
reject('public root classified REEL', x => { x.state.shadow.reelIds.add('888'); });
reject('owned Reel found', x => { x.state.roots.REEL.add('888'); });
reject('native Reel root found', x => {
    x.net.reelsByUserId.get(x.state.userId).set('888', { pk: '888' });
});
reject('Reels tab actually exists', x => { x.showTab(true); });
reject('user is already in Reels view', x => { x.showReelsPath(true); });

const scan = extract('scanAll');
assert.ok(scan.indexOf('reconcileProfileGridCoverage();') <
    scan.indexOf('reconcileEmptyReelsCoverage();'));
assert.ok(scan.indexOf('reconcileEmptyReelsCoverage();') <
    scan.indexOf('const incomplete = incompleteCoverage();'));
assert.ok(!extract('scanReels').includes('total_clips_count === 0'),
    'zero-count authorisation is centralized after source reconciliation, not an early shortcut');
assert.ok(src.includes('Profile API: global='));
console.log('Target-scoped Reels zero-count proof: explicit zero accepted, 22 contrary/missing/partial scenarios blocked.');
