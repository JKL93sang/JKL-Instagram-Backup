import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const re = new RegExp('    (?:async )?function ' + name + '\\(');
    const start = re.exec(src);
    assert.ok(start, 'missing function ' + name);
    const end = src.indexOf('\n    }\n', start.index);
    assert.ok(end > start.index);
    return src.slice(start.index, end + 7);
}

const primary = extract('verifiedPublicGridPrimaryProof');
const assess = extract('assessProfileGridCrossSurfaceProof');
const build = select => new Function(
    'state', 'scanSelected', 'APP',
    primary + '\nreturn verifiedPublicGridPrimaryProof;'
)(select.state, select.scanSelected, {});

function fixture() {
    const id = '10000000000001';
    const state = {
        userId: '45790055326', expected: 1,
        profileInfo: { is_private: false, media_count: 1 },
        exclusive: { known: true, hasExclusiveFeedContent: false },
        shadow: {
            applicable: true, pageInfoEnded: true,
            profileId: '45790055326',
            rootIds: new Set([id]),
            postIds: new Set([id]),
            reelIds: new Set(),
        },
        coverage: {
            publicShadow: true, profileGrid: false,
            reels: false, connectedHidden: true, ownedHydration: true,
        },
        roots: { POST: new Set([id]), REEL: new Set() },
        hidden: {
            candidates: 0, recovered: 0, previewOnly: 0, failed: 0,
        },
    };
    return { state, scanSelected: flag => ['post','reel'].includes(flag) };
}
const x = fixture();
const prove = build(x);
assert.deepEqual(prove(), {
    verified: true, reason: 'public_server_end_exact_counter', count: 1,
}, 'jennnii97 real-world equivalent: public server end with exactly one hydrated post');

const assessment = new Function(assess +
    '\nreturn assessProfileGridCrossSurfaceProof;')();
const proof = assessment({
    selectedPost: true, selectedReel: true,
    publicProfile: true, exclusiveKnown: true, hasExclusive: false,
    shadowApplicable: true, profileId: x.state.userId,
    shadowProfileId: x.state.shadow.profileId,
    shadowComplete: true, shadowPageInfoEnd: true,
    expected: 1, counterVerified: true,
    publicRootIds: x.state.shadow.rootIds,
    publicPostIds: x.state.shadow.postIds,
    publicReelIds: x.state.shadow.reelIds,
    reelsComplete: false, connectedHiddenComplete: true,
    ownedHydrationComplete: true, hiddenCandidates: 0,
    hiddenRecovered: 0, hiddenPreviewOnly: 0, hiddenFailed: 0,
    ownedPostIds: x.state.roots.POST,
    ownedReelIds: x.state.roots.REEL,
    nativeRootIds: new Set(), nativeContinuationPages: 0,
    nativePageInfoEnd: false, nativeLastHasNextFalse: false,
});
assert.equal(proof.verified, true, 'main grid must independently complete');
assert.equal(proof.reason, 'public_connected_cross_surface_proof');
assert.equal(x.state.coverage.reels, false,
    'the REELS surface must not be automatically marked complete');
const incompleteFn = new Function(
    'state', 'requiredCoverage', 'reelsSurfaceSkipped',
    extract('incompleteCoverage') + '\nreturn incompleteCoverage;'
)(
    x.state, () => [['PROFILE grid','profileGrid'], ['REELS tab','reels']],
    () => false // This fixture has no verified no-tab operational skip.
);
x.state.coverage.profileGrid = proof.verified;
assert.deepEqual(incompleteFn(), ['REELS tab'],
    'full archive stays incomplete despite verified PROFILE');

function reject(label, mutation) {
    const f = fixture();
    mutation(f.state);
    assert.equal(build(f)().verified, false, label);
}
reject('no native or public server end', s => {
    s.coverage.publicShadow = false;
});
reject('page still advertises continuation', s => {
    s.shadow.pageInfoEnded = false;
});
reject('wrong profile SSR', s => {
    s.shadow.profileId = 'other';
});
reject('private profile', s => {
    s.profileInfo.is_private = true;
});
reject('unverified exclusivity', s => {
    s.exclusive.known = false;
});
reject('real exclusive content', s => {
    s.exclusive.hasExclusiveFeedContent = true;
});
reject('counter disagreement', s => {
    s.profileInfo.media_count = 2;
});
reject('expected count mismatch', s => {
    s.expected = 2;
});
reject('partial public timeline', s => {
    s.shadow.rootIds.clear();
});
reject('public clip unhydrated', s => {
    s.shadow.reelIds.add('200');
    s.shadow.rootIds.add('200');
});
reject('public POST not hydrated', s => {
    s.roots.POST.clear();
});
reject('public root partition disagreement', s => {
    s.shadow.postIds.clear();
});
reject('zero publications has no exhaustive evidence', s => {
    s.expected = 0;
    s.profileInfo.media_count = 0;
    s.shadow.rootIds.clear();
    s.shadow.postIds.clear();
});

const scanAll = extract('scanAll');
const beforeProfile = scanAll.indexOf("'PROFILE GRID'");
const beforeShadow = scanAll.indexOf("'PUBLIC SHADOW'");
const publicProof = scanAll.indexOf('verifiedPublicGridPrimaryProof()');
assert.ok(beforeShadow >= 0 && beforeShadow < beforeProfile,
    'PUBLIC server-backed collection must happen BEFORE native grid capture');
assert.ok(beforeShadow < publicProof && publicProof < beforeProfile,
    'a completed public proof must prevent the native capture phase');
assert.ok(scanAll.includes("scanMainGrid"),
    'native PROFILE remains available as fallback on incomplete public evidence');
assert.ok(scanAll.includes("reconcileProfileGridCoverage();"),
    'independent reconciliation must still run after hydration and hidden verification');
assert.ok(!assess.includes('!proof.reelsComplete'),
    'REELS coverage must not be a hidden dependency of PROFILE completion');

console.log('Public-first independent PROFILE completion: one-post no-reels-tab proof, safe fallbacks and separate REELS guard passed.');
