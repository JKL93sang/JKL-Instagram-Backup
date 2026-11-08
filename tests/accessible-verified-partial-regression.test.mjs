import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url),
    'utf8'
);

function extract(name) {
    let start = source.indexOf('    function ' + name + '(');
    if (start < 0) start = source.indexOf('    async function ' + name + '(');
    assert.ok(start >= 0, 'missing function ' + name);
    const end = source.indexOf('\n    }\n', start);
    assert.ok(end > start, 'missing function boundary ' + name);
    return source.slice(start, end + 7);
}

const methods = [
    'mediaArchiveCategory',
    'hiddenDiscoverySources',
    'scanDownloadFingerprint',
    'verifiedAccessibleMedia',
    'accessibleSourceProofFingerprint',
    'captureVerifiedAccessibleSnapshot',
    'verifiedAccessibleDownloadIntegrity',
    'cleanUser',
].map(extract).join('\n');

function item(id, type, sourceTag, rootId = id, props = {}) {
    return {
        id, type, filename: id + '.jpg',
        url: 'https://example.test/' + id,
        sources: new Set([sourceTag]),
        rootIds: new Set([rootId]),
        ...props,
    };
}

function fixture({ highlights = 2 } = {}) {
    const profileId = '45790055326';
    const state = {
        username: 'jennnii97',
        userId: profileId,
        running: true, // scanAll has not yet entered finally
        downloading: false,
        cancelled: false,
        feedbackRequired: false,
        rateLimited: false,
        apiUnhealthy: false,
        scanComplete: false,
        scanOutcome: 'INCOMPLETE',
        scanPlan: Object.freeze({
            post: true, reel: true, tagged: false,
            highlight: true, story: true, avatar: true,
        }),
        queue: new Map(),
        coverage: {
            profileGrid: false,
            publicShadow: true,
            connectedHidden: true,
            reels: false,
            ownedHydration: true,
            highlights: true,
            story: true,
            avatar: true,
        },
        shadow: {
            applicable: true, pageInfoEnded: true,
            profileId, postIds: new Set(['public-root']),
        },
        roots: {
            POST: new Set(['public-root']),
            REEL: new Set(['unverified-reel']),
            TAGGED: new Set(),
            HIGHLIGHT: new Set(),
            STORY: new Set(['story-1']),
            AVATAR: new Set(['avatar-1']),
        },
        verifiedAccessibleSnapshot: null,
    };
    state.queue.set('post-1', item('post-1', 'POST',
        'PROFILE_PUBLIC_SHADOW', 'public-root'));
    for (let i = 0; i < highlights; i++) {
        const id = 'highlight-' + i;
        state.roots.HIGHLIGHT.add(id);
        state.queue.set(id, item(id, 'HIGHLIGHT', 'HIGHLIGHT:Winter'));
    }
    state.queue.set('story-1', item('story-1', 'STORY', 'STORY_WEB_GRAPHQL'));
    state.queue.set('avatar-1', item('avatar-1', 'AVATAR', 'AVATAR'));

    // None of these may leak into the verified accessible scope.
    state.queue.set('unverified-reel', item('unverified-reel', 'REEL', 'REELS_NATIVE'));
    state.queue.set('unverified-tagged', item('unverified-tagged', 'TAGGED', 'TAGGED'));
    state.queue.set('wrong-public', item('wrong-public', 'POST', 'PROFILE_PUBLIC_SHADOW',
        'different-root'));
    state.queue.set('native-only', item('native-only', 'POST', 'PROFILE_NATIVE',
        'public-root'));
    state.queue.set('subscriber', item('subscriber', 'POST',
        'CONNECTED_HIDDEN_AUTHORIZED', 'public-root', { visibility: 'fan_club' }));
    state.queue.set('connected-hidden', item('connected-hidden', 'POST',
        'CONNECTED_HIDDEN_AUTHORIZED', 'public-root', { visibility: 'hidden' }));
    state.queue.set('unproven-highlight', item('unproven-highlight', 'HIGHLIGHT',
        'HIGHLIGHT:Bad', 'unproven-highlight'));
    state.queue.set('missing-url', item('missing-url', 'AVATAR', 'AVATAR',
        'missing-url', { url: '' }));

    const ui = { username: { value: 'jennnii97' } };
    const logs = [];
    const h = new Function(
        'state', 'ui', 'HIDDEN_DISCOVERY_SOURCES', 'currentProfile', 'log',
        methods + '\nreturn { verifiedAccessibleMedia, ' +
        'captureVerifiedAccessibleSnapshot, verifiedAccessibleDownloadIntegrity };'
    )(
        state, ui,
        new Set(['PROFILE_PUBLIC_SHADOW', 'CONNECTED_HIDDEN_AUTHORIZED']),
        () => 'jennnii97',
        (...args) => logs.push(args),
    );
    return { state, ui, logs, ...h };
}

const f = fixture({ highlights: 176 });
assert.equal(f.verifiedAccessibleMedia().length, 179,
    '1 public POST + 176 highlights + 1 story + 1 avatar must be eligible');
f.captureVerifiedAccessibleSnapshot();
assert.ok(f.state.verifiedAccessibleSnapshot,
    'snapshot must be captured while scanAll.running is true');
assert.equal(f.state.verifiedAccessibleSnapshot.mediaCount, 179);
assert.equal(f.state.coverage.profileGrid, false);
assert.equal(f.state.coverage.reels, false);
assert.equal(f.state.scanOutcome, 'INCOMPLETE');
assert.ok(Object.isFrozen(f.state.verifiedAccessibleSnapshot));
assert.ok(Object.isFrozen(f.state.verifiedAccessibleSnapshot.mediaIds));
f.state.running = false;
assert.equal(f.verifiedAccessibleDownloadIntegrity().ok, true);

function testScope(label, modify, expected) {
    const x = fixture();
    modify(x);
    const actual = x.verifiedAccessibleMedia().map(m => m.id);
    assert.deepEqual(actual.includes(expected.id), expected.included, label);
}
testScope('shadow has no terminal page', x => {
    x.state.shadow.pageInfoEnded = false;
}, { id: 'post-1', included: false });
testScope('shadow refers to another profile', x => {
    x.state.shadow.profileId = 'someone-else';
}, { id: 'post-1', included: false });
testScope('PUBLIC SHADOW did not finish', x => {
    x.state.coverage.publicShadow = false;
}, { id: 'post-1', included: false });
testScope('POST hydration incomplete', x => {
    x.state.coverage.ownedHydration = false;
}, { id: 'post-1', included: false });
testScope('highlight pagination incomplete', x => {
    x.state.coverage.highlights = false;
}, { id: 'highlight-0', included: false });
testScope('story source unproven', x => {
    x.state.coverage.story = false;
}, { id: 'story-1', included: false });
testScope('avatar missing evidence', x => {
    x.state.coverage.avatar = false;
}, { id: 'avatar-1', included: false });
testScope('not selected', x => {
    x.state.scanPlan = { ...x.state.scanPlan, highlight: false };
}, { id: 'highlight-0', included: false });
testScope('exact public POST remains permitted', () => {},
    { id: 'post-1', included: true });

function rejectAtCapture(label, change) {
    const x = fixture();
    change(x);
    x.captureVerifiedAccessibleSnapshot();
    assert.equal(x.state.verifiedAccessibleSnapshot, null, label);
}
rejectAtCapture('complete scan', x => {
    x.state.scanOutcome = 'COMPLETE'; x.state.scanComplete = true;
});
rejectAtCapture('cancelled', x => { x.state.cancelled = true; });
rejectAtCapture('API unhealthy', x => { x.state.apiUnhealthy = true; });
rejectAtCapture('rate-limited', x => { x.state.rateLimited = true; });
rejectAtCapture('feedback-required', x => { x.state.feedbackRequired = true; });
rejectAtCapture('no eligible surface', x => {
    x.state.coverage.publicShadow = false;
    x.state.coverage.highlights = false;
    x.state.coverage.story = false;
    x.state.coverage.avatar = false;
});

function rejectAfterCapture(label, change) {
    const x = fixture();
    x.captureVerifiedAccessibleSnapshot();
    x.state.running = false;
    assert.equal(x.verifiedAccessibleDownloadIntegrity().ok, true,
        label + ' initial');
    change(x);
    assert.equal(x.verifiedAccessibleDownloadIntegrity().ok, false, label);
}
rejectAfterCapture('different profile ID', x => { x.state.userId = 'other'; });
rejectAfterCapture('username input changed', x => { x.ui.username.value = 'other'; });
rejectAfterCapture('different user', x => { x.state.username = 'other'; });
rejectAfterCapture('queue changed', x => {
    x.state.queue.set('extra', item('extra', 'AVATAR', 'AVATAR'));
});
rejectAfterCapture('signed URL changed', x => {
    x.state.queue.get('post-1').url += '?modified';
});
rejectAfterCapture('source changed', x => {
    x.state.queue.get('post-1').sources.delete('PROFILE_PUBLIC_SHADOW');
});
rejectAfterCapture('media root changed', x => {
    x.state.queue.get('post-1').rootIds.clear();
});
rejectAfterCapture('shadow root set changed', x => {
    x.state.shadow.postIds.add('other-root');
});
rejectAfterCapture('highlight coverage changed', x => {
    x.state.coverage.highlights = false;
});
rejectAfterCapture('reels/scan retried', x => { x.state.scanOutcome = 'RUNNING'; });
rejectAfterCapture('running again', x => { x.state.running = true; });
rejectAfterCapture('API circuit opened', x => { x.state.apiUnhealthy = true; });

const download = extract('downloadMissing');
assert.ok(download.includes("authorizedOnly === 'accessible'"));
assert.ok(download.includes('verifiedAccessibleDownloadIntegrity()'));
assert.ok(download.includes('completedScanIntegrity()'));
assert.ok(download.includes('verifiedSubscriberDownloadIntegrity()'));
assert.ok(download.includes('if (!authorizedOnly)'));
assert.ok(download.includes('unverifiedArchiveHistory(mediaScope)'));
assert.ok(source.includes('DOWNLOAD VERIFIED ACCESSIBLE (PARTIAL)'));
assert.ok(source.includes('downloadVerifiedAccessiblePartial'));
assert.ok(source.includes("return downloadMissing('accessible');"));
assert.ok(source.includes('captureVerifiedAccessibleSnapshot();'));
assert.ok(source.includes('state.verifiedAccessibleSnapshot = null;'));
assert.ok(source.includes('state.coverage.reels = false') ||
    source.includes('state.coverage.reels =\n'));

function simulatedRunner(x, ledgerBlocked = false) {
    const saved = [];
    const seenScopes = [];
    const statuses = [];
    const disabled = [];
    const flushes = [];
    const downloadOne = async m => {
        saved.push(m.id);
        x.state.downloadProgress.completed++;
        x.state.downloadProgress.succeeded++;
    };
    const beginDownloadProgress = list => {
        x.state.downloadProgress = {
            status: 'running', total: list.length,
            completed: 0, succeeded: 0, failed: 0, blocked: 0, current: '',
        };
        return { total: list.length, main: list.length, hidden: 0 };
    };
    const run = new Function(
        'state', 'status', 'log',
        'verifiedAccessibleDownloadIntegrity',
        'verifiedSubscriberDownloadIntegrity',
        'completedScanIntegrity', 'incompleteCoverage',
        'unverifiedArchiveHistory', 'disable', 'existingReason',
        'beginDownloadProgress', 'APP', 'sleep',
        'downloadOne', 'updateStats', 'flushLedger',
        extract('downloadMissing') + '\nreturn downloadMissing;'
    )(
        x.state,
        (message, level) => statuses.push({ message, level }),
        (...args) => x.logs.push(args),
        x.verifiedAccessibleDownloadIntegrity,
        () => ({ ok: false, reason: 'no subscriber proof' }),
        () => ({ ok: false, reason: 'PROFILE/REELS incomplete' }),
        () => ['PROFILE grid', 'REELS tab'],
        records => {
            seenScopes.push([...records].map(m => m.id));
            return ledgerBlocked
                ? { total: 1, ledger: 1 }
                : { total: 0, ledger: 0 };
        },
        value => disabled.push(value),
        () => null,
        beginDownloadProgress,
        { DOWNLOAD_WORKERS: 1, DOWNLOAD_DELAY: 0, DOWNLOAD_RETRIES: 3 },
        async () => {},
        downloadOne,
        () => {},
        value => flushes.push(value)
    );
    return { run, saved, seenScopes, statuses, disabled, flushes };
}

const downloadCase = fixture({ highlights: 176 });
downloadCase.captureVerifiedAccessibleSnapshot();
downloadCase.state.running = false;
const runner = simulatedRunner(downloadCase);
await runner.run(false);
assert.equal(runner.saved.length, 0, 'FULL backup cannot bypass INCOMPLETE');
await runner.run(true);
assert.equal(runner.saved.length, 0, 'subscriber route needs separate authorization');
await runner.run('accessible');
assert.equal(runner.saved.length, 179, 'partial scope must exactly match verified 179');
assert.ok(!runner.saved.includes('unverified-reel'));
assert.ok(!runner.saved.includes('subscriber'));
assert.ok(!runner.saved.includes('connected-hidden'));
assert.deepEqual(runner.seenScopes[0].length, 179);
assert.deepEqual(runner.disabled, [true, false]);
assert.deepEqual(runner.flushes, [true]);
assert.equal(downloadCase.state.scanOutcome, 'INCOMPLETE');
assert.equal(downloadCase.state.coverage.reels, false);

const historyCase = fixture();
historyCase.captureVerifiedAccessibleSnapshot();
historyCase.state.running = false;
const historyRunner = simulatedRunner(historyCase, true);
await historyRunner.run('accessible');
assert.equal(historyRunner.saved.length, 0,
    'ledger-only history requires local folder confirmation');
assert.ok(historyRunner.statuses.some(s => s.message.includes('SCAN LOCAL FOLDER')));

console.log('Verified-accessible partial backup scope, immutable proof and download guards passed.');
