import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const match = source.match(new RegExp('    (?:async )?function ' + name + '\\('));
    assert.ok(match, 'missing function ' + name);
    const end = source.indexOf('\n    }\n', match.index);
    assert.ok(end > match.index, 'missing function end: ' + name);
    return source.slice(match.index, end + 7);
}

const MODE = Object.freeze({
    COMPLETE: 'complete', SUBSCRIBER: 'subscriber', ACCESSIBLE: 'accessible',
});
const LABEL = Object.freeze({
    complete: 'Download batch', subscriber: 'VERIFIED SUBSCRIBER PARTIAL',
    accessible: 'VERIFIED ACCESSIBLE PARTIAL',
});
const methods = [
    'mediaArchiveCategory', 'hiddenDiscoverySources', 'scanDownloadFingerprint',
    'verifiedSubscriberMedia', 'verifiedAccessibleMedia',
    'accessibleSourceProofFingerprint', 'subscriberSourceProofVerified',
    'partialSourceVerified', 'verifiedPartialMedia', 'partialSourceFingerprint',
    'clearPartialDownloadGrants', 'capturePartialDownloadGrants',
    'verifiedPartialDownloadIntegrity', 'authorizeDownloadScope', 'cleanUser',
].map(extract).join('\n');

function item(id, type, origin, root = id, extra = {}) {
    return {
        id, type, filename: id + '.jpg',
        url: 'https://example.test/' + id,
        sources: new Set([origin]), rootIds: new Set([root]), ...extra,
    };
}
function fixture(highlights = 2) {
    const uid = '45790055326';
    const state = {
        username: 'jennnii97', userId: uid,
        running: true, // scanAll has completed phases, finally has not run
        downloading: false, cancelled: false,
        feedbackRequired: false, rateLimited: false, apiUnhealthy: false,
        scanOutcome: 'INCOMPLETE', scanComplete: false,
        scanPlan: Object.freeze({
            post: true, reel: true, tagged: false,
            highlight: true, story: true, avatar: true,
        }),
        queue: new Map(),
        partialDownloadGrants: { subscriber: null, accessible: null },
        verifiedSubscriberRootIds: new Set(),
        exclusive: { known: false, hasExclusiveFeedContent: false },
        hidden: {
            candidates: 0, recovered: 0, alreadyOwned: 0,
            previewOnly: 0, failed: 0,
        },
        coverage: {
            profileGrid: false, reels: false, connectedHidden: true,
            publicShadow: true, ownedHydration: true,
            highlights: true, story: true, avatar: true,
        },
        shadow: {
            applicable: true, profileId: uid, pageInfoEnded: true,
            postIds: new Set(['public-root']),
        },
        roots: {
            POST: new Set(['public-root']), REEL: new Set(), TAGGED: new Set(),
            HIGHLIGHT: new Set(), STORY: new Set(),
            AVATAR: new Set(['avatar-1']),
        },
    };

    state.queue.set('post-1', item('post-1', 'POST',
        'PROFILE_PUBLIC_SHADOW', 'public-root'));
    for (let i = 0; i < highlights; i++) {
        const id = 'highlight-' + i;
        state.queue.set(id, item(id, 'HIGHLIGHT', 'HIGHLIGHT:Winter'));
    }
    state.queue.set('story-1', item('story-1', 'STORY', 'STORY_WEB_GRAPHQL'));
    state.queue.set('avatar-1', item('avatar-1', 'AVATAR', 'AVATAR'));

    state.queue.set('reel-unverified', item('reel-unverified', 'REEL', 'REEL_NATIVE'));
    state.queue.set('tagged-unverified', item('tagged-unverified', 'TAGGED', 'TAGGED'));
    state.queue.set('wrong-public', item('wrong-public', 'POST',
        'PROFILE_PUBLIC_SHADOW', 'other-root'));
    state.queue.set('native-only', item('native-only', 'POST',
        'PROFILE_NATIVE', 'public-root'));
    state.queue.set('subscriber', item('subscriber', 'POST',
        'CONNECTED_HIDDEN_AUTHORIZED', 'public-root', { visibility: 'fan_club' }));
    state.queue.set('hidden', item('hidden', 'POST',
        'CONNECTED_HIDDEN_AUTHORIZED', 'public-root', { visibility: 'hidden' }));
    state.queue.set('bad-highlight', item('bad-highlight', 'HIGHLIGHT', 'OTHER'));
    state.queue.set('missing-url', item('missing-url', 'AVATAR', 'AVATAR',
        'missing-url', { url: '' }));

    const ui = { username: { value: 'jennnii97' } };
    const logs = [];
    const h = new Function(
        'state', 'ui', 'HIDDEN_DISCOVERY_SOURCES',
        'DOWNLOAD_MODE', 'PARTIAL_DOWNLOAD_MODES', 'currentProfile',
        'completedScanIntegrity', 'incompleteCoverage', 'log',
        methods + '\nreturn { verifiedAccessibleMedia, capturePartialDownloadGrants, ' +
        'verifiedPartialDownloadIntegrity, authorizeDownloadScope, clearPartialDownloadGrants };'
    )(
        state, ui,
        new Set(['PROFILE_PUBLIC_SHADOW', 'CONNECTED_HIDDEN_AUTHORIZED']),
        MODE, [MODE.SUBSCRIBER, MODE.ACCESSIBLE],
        () => 'jennnii97',
        () => ({ ok: false, reason: 'PROFILE/REELS incomplete' }),
        () => ['PROFILE grid', 'REELS tab'],
        (...args) => logs.push(args)
    );
    return { state, ui, logs, ...h };
}

const f = fixture(176);
assert.equal(f.verifiedAccessibleMedia().length, 179,
    'only 1 public POST, 176 highlights, 1 story and 1 avatar qualify');
f.capturePartialDownloadGrants();
assert.equal(f.state.partialDownloadGrants.accessible.mediaCount, 179);
assert.equal(f.state.partialDownloadGrants.subscriber, null);
assert.ok(Object.isFrozen(f.state.partialDownloadGrants.accessible));
assert.ok(Object.isFrozen(f.state.partialDownloadGrants.accessible.mediaIds));
assert.equal(f.state.scanOutcome, 'INCOMPLETE');
assert.equal(f.state.coverage.reels, false);
assert.equal(f.verifiedPartialDownloadIntegrity(MODE.ACCESSIBLE).ok, false,
    'must not download while scanAll.running');
f.state.running = false;
assert.equal(f.verifiedPartialDownloadIntegrity(MODE.ACCESSIBLE).ok, true);
assert.equal(f.authorizeDownloadScope(MODE.COMPLETE).ok, false);
assert.equal(f.authorizeDownloadScope(MODE.SUBSCRIBER).ok, false);
assert.equal(f.authorizeDownloadScope('unknown').ok, false);
assert.ok(f.logs.some(x => x[0].includes('ACCESSIBLE PARTIAL READY')));

function excludedWhen(label, mutate, id) {
    const x = fixture(); mutate(x);
    assert.ok(!x.verifiedAccessibleMedia().some(m => m.id === id), label);
}
excludedWhen('public pagination unfinished', x => {
    x.state.shadow.pageInfoEnded = false;
}, 'post-1');
excludedWhen('wrong shadow identity', x => {
    x.state.shadow.profileId = 'other';
}, 'post-1');
excludedWhen('public coverage false', x => {
    x.state.coverage.publicShadow = false;
}, 'post-1');
excludedWhen('public hydration incomplete', x => {
    x.state.coverage.ownedHydration = false;
}, 'post-1');
excludedWhen('highlights not ended', x => {
    x.state.coverage.highlights = false;
}, 'highlight-0');
excludedWhen('stories not ended', x => {
    x.state.coverage.story = false;
}, 'story-1');
excludedWhen('avatar not verified', x => {
    x.state.coverage.avatar = false;
}, 'avatar-1');
excludedWhen('highlight not selected', x => {
    x.state.scanPlan = { ...x.state.scanPlan, highlight: false };
}, 'highlight-0');

function noGrantWhen(label, mutate) {
    const x = fixture(); mutate(x); x.capturePartialDownloadGrants();
    assert.equal(x.state.partialDownloadGrants.accessible, null, label);
}
noGrantWhen('scan COMPLETE', x => { x.state.scanOutcome = 'COMPLETE'; });
noGrantWhen('cancelled', x => { x.state.cancelled = true; });
noGrantWhen('429', x => { x.state.rateLimited = true; });
noGrantWhen('feedback', x => { x.state.feedbackRequired = true; });
noGrantWhen('API unhealthy', x => { x.state.apiUnhealthy = true; });
noGrantWhen('no complete surfaces', x => {
    x.state.coverage.publicShadow = false;
    x.state.coverage.highlights = false;
    x.state.coverage.story = false;
    x.state.coverage.avatar = false;
});

function invalidatedBy(label, mutate) {
    const x = fixture(); x.capturePartialDownloadGrants(); x.state.running = false;
    assert.equal(x.verifiedPartialDownloadIntegrity(MODE.ACCESSIBLE).ok, true);
    mutate(x);
    assert.equal(x.verifiedPartialDownloadIntegrity(MODE.ACCESSIBLE).ok, false, label);
}
invalidatedBy('user id changed', x => { x.state.userId = 'other'; });
invalidatedBy('username changed', x => { x.ui.username.value = 'other'; });
invalidatedBy('queue grew', x => { x.state.queue.set('extra', {}); });
invalidatedBy('URL changed', x => { x.state.queue.get('post-1').url += '?changed'; });
invalidatedBy('media origin changed', x => {
    x.state.queue.get('post-1').sources.delete('PROFILE_PUBLIC_SHADOW');
});
invalidatedBy('root owner changed', x => {
    x.state.queue.get('post-1').rootIds.clear();
});
invalidatedBy('public root set changed', x => {
    x.state.shadow.postIds.add('other');
});
invalidatedBy('coverage revoked', x => { x.state.coverage.highlights = false; });
invalidatedBy('scan retried', x => { x.state.scanOutcome = 'RUNNING'; });
invalidatedBy('API circuit opened', x => { x.state.apiUnhealthy = true; });
invalidatedBy('running again', x => { x.state.running = true; });

function simulatedDownload(x, blockedLedger = false) {
    const saved = [], scopes = [], messages = [], disabled = [], flushes = [];
    const run = new Function(
        'state', 'status', 'log', 'authorizeDownloadScope',
        'DOWNLOAD_MODE', 'DOWNLOAD_MODE_LABEL',
        'unverifiedArchiveHistory', 'disable', 'existingReason',
        'beginDownloadProgress', 'APP', 'sleep', 'downloadOne',
        'updateStats', 'flushLedger',
        extract('downloadMissing') + '\nreturn downloadMissing;'
    )(
        x.state, (message, level) => messages.push({ message, level }),
        (...args) => x.logs.push(args), x.authorizeDownloadScope,
        MODE, LABEL,
        media => {
            scopes.push([...media].map(m => m.id));
            return blockedLedger ? { total: 1, ledger: 1 } : { total: 0, ledger: 0 };
        },
        value => disabled.push(value),
        () => null,
        media => {
            x.state.downloadProgress = {
                status: 'running', total: media.length, completed: 0,
                succeeded: 0, failed: 0, blocked: 0, current: '',
            };
            return { total: media.length, main: media.length, hidden: 0 };
        },
        { DOWNLOAD_WORKERS: 1, DOWNLOAD_DELAY: 0, DOWNLOAD_RETRIES: 3 },
        async () => {},
        async m => {
            saved.push(m.id); x.state.downloadProgress.completed++;
            x.state.downloadProgress.succeeded++;
        },
        () => {}, value => flushes.push(value)
    );
    return { run, saved, scopes, messages, disabled, flushes };
}
const downloadCase = fixture(176);
downloadCase.capturePartialDownloadGrants();
downloadCase.state.running = false;
const dl = simulatedDownload(downloadCase);
await dl.run(MODE.COMPLETE);
await dl.run(MODE.SUBSCRIBER);
await dl.run('random');
assert.equal(dl.saved.length, 0);
await dl.run(MODE.ACCESSIBLE);
assert.equal(dl.saved.length, 179);
assert.equal(new Set(dl.saved).size, 179);
assert.ok(!dl.saved.includes('reel-unverified'));
assert.ok(!dl.saved.includes('subscriber'));
assert.ok(!dl.saved.includes('hidden'));
assert.equal(dl.scopes[0].length, 179);
assert.deepEqual(dl.disabled, [true, false]);
assert.deepEqual(dl.flushes, [true]);
assert.equal(downloadCase.state.scanOutcome, 'INCOMPLETE');

const history = fixture();
history.capturePartialDownloadGrants();
history.state.running = false;
const historyDL = simulatedDownload(history, true);
await historyDL.run(MODE.ACCESSIBLE);
assert.equal(historyDL.saved.length, 0);
assert.ok(historyDL.messages.some(x => x.message.includes('SCAN LOCAL FOLDER')));
assert.ok(source.includes('DOWNLOAD VERIFIED ACCESSIBLE (PARTIAL)'));
assert.ok(!source.includes('authorizedOnly'));
console.log('Unified accessible evidence grant, 179-media scope and fail-closed tests passed.');
