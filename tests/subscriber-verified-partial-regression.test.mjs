import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);

function extract(name) {
    const match = source.match(
        new RegExp('    (?:async )?function ' + name + '\\(')
    );
    assert.ok(match, 'missing function ' + name);
    const start = match.index;
    const end = source.indexOf('\n    }\n', start);
    assert.ok(end > start, 'missing end of ' + name);
    return source.slice(start, end + 7);
}

const MODE = Object.freeze({
    COMPLETE: 'complete', SUBSCRIBER: 'subscriber', ACCESSIBLE: 'accessible',
});
const MODE_LABEL = Object.freeze({
    complete: 'Download batch',
    subscriber: 'VERIFIED SUBSCRIBER PARTIAL',
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

function fixture() {
    const state = {
        username: 'subscriber.test', userId: '710001',
        scanPlan: { post: true, reel: true, story: false, highlight: false, avatar: false },
        scanOutcome: 'INCOMPLETE', scanComplete: false,
        queue: new Map(),
        verifiedSubscriberRootIds: new Set(),
        partialDownloadGrants: { subscriber: null, accessible: null },
        running: false, downloading: false, cancelled: false,
        feedbackRequired: false, rateLimited: false, apiUnhealthy: false,
        exclusive: { known: true, hasExclusiveFeedContent: true },
        coverage: {
            profileGrid: false, publicShadow: false,
            connectedHidden: true, ownedHydration: true,
        },
        hidden: {
            candidates: 65, recovered: 65, alreadyOwned: 0,
            previewOnly: 0, failed: 0,
        },
        shadow: {
            applicable: false, pageInfoEnded: false, profileId: '',
            postIds: new Set(),
        },
        roots: {
            HIGHLIGHT: new Set(), STORY: new Set(), AVATAR: new Set(),
        },
    };

    for (let i = 0; i < 65; i++) {
        const rootId = String(900000 + i);
        const id = String(1100000 + i);
        state.verifiedSubscriberRootIds.add(rootId);
        state.queue.set(id, {
            id, type: 'POST', filename: id + '.jpg',
            url: 'https://example.test/owned-' + id,
            sources: new Set(['CONNECTED_HIDDEN_AUTHORIZED']),
            rootIds: new Set([rootId]),
        });
    }
    const extraneous = [
        ['public', 'PROFILE_PUBLIC_SHADOW', 'other'],
        ['preview-only', 'OTHER', '900000'],
        ['unverified', 'CONNECTED_HIDDEN_AUTHORIZED', 'missing-root'],
    ];
    for (const [id, origin, root] of extraneous) {
        state.queue.set(id, {
            id, type: 'POST', filename: id + '.jpg',
            url: 'https://example.test/' + id,
            sources: new Set([origin]), rootIds: new Set([root]),
        });
    }

    const ui = { username: { value: 'subscriber.test' } };
    const logs = [];
    const f = new Function(
        'state', 'ui', 'HIDDEN_DISCOVERY_SOURCES',
        'DOWNLOAD_MODE', 'PARTIAL_DOWNLOAD_MODES', 'currentProfile',
        'completedScanIntegrity', 'incompleteCoverage', 'log',
        methods + '\nreturn {' +
            'verifiedSubscriberMedia, clearPartialDownloadGrants, ' +
            'capturePartialDownloadGrants, verifiedPartialDownloadIntegrity, ' +
            'authorizeDownloadScope };'
    )(
        state, ui,
        new Set(['PROFILE_PUBLIC_SHADOW', 'CONNECTED_HIDDEN_AUTHORIZED']),
        MODE, [MODE.SUBSCRIBER, MODE.ACCESSIBLE],
        () => 'subscriber.test',
        () => ({ ok: false, reason: 'PROFILE is not complete' }),
        () => ['PROFILE grid'],
        (...args) => logs.push(args),
    );
    return { state, ui, logs, ...f };
}

const base = fixture();
base.capturePartialDownloadGrants();
assert.equal(base.state.partialDownloadGrants.subscriber.mediaCount, 65);
assert.equal(base.state.partialDownloadGrants.accessible, null);
assert.equal(base.verifiedPartialDownloadIntegrity(MODE.SUBSCRIBER).ok, true);
assert.equal(base.verifiedPartialDownloadIntegrity(MODE.ACCESSIBLE).ok, false);
assert.equal(base.authorizeDownloadScope(MODE.COMPLETE).ok, false);
assert.equal(base.authorizeDownloadScope('unexpected').ok, false);
assert.equal(base.state.scanOutcome, 'INCOMPLETE');
assert.ok(Object.isFrozen(base.state.partialDownloadGrants.subscriber));
assert.ok(Object.isFrozen(base.state.partialDownloadGrants.subscriber.mediaIds));
assert.ok(base.logs.some(x => x[0].includes('SUBSCRIBER PARTIAL READY')));

function rejectBefore(label, mutate) {
    const x = fixture(); mutate(x); x.capturePartialDownloadGrants();
    assert.equal(x.state.partialDownloadGrants.subscriber, null, label);
}
rejectBefore('COMPLETE not partial', x => { x.state.scanOutcome = 'COMPLETE'; });
rejectBefore('no subscriber entitlement', x => {
    x.state.exclusive.hasExclusiveFeedContent = false;
});
rejectBefore('unknown entitlement', x => { x.state.exclusive.known = false; });
rejectBefore('no POST scan', x => { x.state.scanPlan.post = false; });
rejectBefore('no REEL scan', x => { x.state.scanPlan.reel = false; });
rejectBefore('candidate mismatch', x => { x.state.hidden.candidates = 66; });
rejectBefore('preview only', x => { x.state.hidden.previewOnly = 1; });
rejectBefore('hidden request failure', x => { x.state.hidden.failed = 1; });
rejectBefore('no hydrated roots', x => { x.state.coverage.ownedHydration = false; });
rejectBefore('no complete hidden scan', x => { x.state.coverage.connectedHidden = false; });
rejectBefore('lost authorized root', x => {
    x.state.verifiedSubscriberRootIds.delete('900000');
});
rejectBefore('cancelled scan', x => { x.state.cancelled = true; });
rejectBefore('429 safety', x => { x.state.rateLimited = true; });
rejectBefore('feedback safety', x => { x.state.feedbackRequired = true; });
rejectBefore('unhealthy API', x => { x.state.apiUnhealthy = true; });

function rejectAfter(label, mutate) {
    const x = fixture(); x.capturePartialDownloadGrants();
    assert.equal(x.verifiedPartialDownloadIntegrity(MODE.SUBSCRIBER).ok, true);
    mutate(x);
    assert.equal(x.verifiedPartialDownloadIntegrity(MODE.SUBSCRIBER).ok, false, label);
}
rejectAfter('account ID changed', x => { x.state.userId = 'other'; });
rejectAfter('username input changed', x => { x.ui.username.value = 'other'; });
rejectAfter('queue grew', x => { x.state.queue.set('new', {}); });
rejectAfter('signed URL changed', x => {
    x.state.queue.get('1100000').url += '?changed';
});
rejectAfter('media source changed', x => {
    x.state.queue.get('1100000').sources.delete('CONNECTED_HIDDEN_AUTHORIZED');
});
rejectAfter('root ownership changed', x => {
    x.state.queue.get('1100000').rootIds.clear();
});
rejectAfter('authorized roots changed', x => {
    x.state.verifiedSubscriberRootIds.delete('900000');
});
rejectAfter('hydration revoked', x => { x.state.coverage.ownedHydration = false; });
rejectAfter('scan rerun', x => { x.state.scanOutcome = 'RUNNING'; });
rejectAfter('running scan', x => { x.state.running = true; });
rejectAfter('feedback circuit', x => { x.state.feedbackRequired = true; });

function simulatedDownload(x, { ledgerBlocked = false, failLast = false } = {}) {
    const saved = [], scopes = [], messages = [], disabled = [], flushes = [];
    const beginDownloadProgress = media => {
        x.state.downloadProgress = {
            status: 'running', total: media.length, completed: 0,
            succeeded: 0, failed: 0, blocked: 0, current: '',
        };
        return { main: media.length, hidden: 0, total: media.length };
    };
    const run = new Function(
        'state', 'status', 'log', 'authorizeDownloadScope', 'DOWNLOAD_MODE',
        'DOWNLOAD_MODE_LABEL', 'unverifiedArchiveHistory', 'disable',
        'existingReason', 'beginDownloadProgress', 'APP', 'sleep', 'downloadOne',
        'updateStats', 'flushLedger',
        extract('downloadMissing') + '\nreturn downloadMissing;'
    )(
        x.state,
        (message, level) => messages.push({ message, level }),
        (...args) => x.logs.push(args),
        x.authorizeDownloadScope,
        MODE, MODE_LABEL,
        media => {
            scopes.push([...media].map(x => x.id));
            return ledgerBlocked ? { total: 1, ledger: 1 } : { total: 0, ledger: 0 };
        },
        value => disabled.push(value),
        () => null,
        beginDownloadProgress,
        { DOWNLOAD_WORKERS: 1, DOWNLOAD_DELAY: 0, DOWNLOAD_RETRIES: 3 },
        async () => {},
        async media => {
            saved.push(media.id);
            x.state.downloadProgress.completed++;
            if (failLast && saved.length === 65) x.state.downloadProgress.failed++;
            else x.state.downloadProgress.succeeded++;
        },
        () => {}, value => flushes.push(value)
    );
    return { run, saved, scopes, messages, disabled, flushes };
}

const x = fixture(); x.capturePartialDownloadGrants();
const test = simulatedDownload(x);
await test.run(MODE.COMPLETE);
await test.run(MODE.ACCESSIBLE);
await test.run('unknown');
assert.equal(test.saved.length, 0, 'other modes must never acquire subscriber data');
await test.run(MODE.SUBSCRIBER);
assert.equal(test.saved.length, 65);
assert.equal(new Set(test.saved).size, 65);
assert.ok(!test.saved.includes('public'));
assert.ok(!test.saved.includes('preview-only'));
assert.ok(!test.saved.includes('unverified'));
assert.equal(test.scopes[0].length, 65);
assert.equal(x.state.downloadProgress.succeeded, 65);
assert.equal(x.state.scanOutcome, 'INCOMPLETE');
assert.deepEqual(test.disabled, [true, false]);
assert.deepEqual(test.flushes, [true]);

const blocked = fixture(); blocked.capturePartialDownloadGrants();
const blockedTest = simulatedDownload(blocked, { ledgerBlocked: true });
await blockedTest.run(MODE.SUBSCRIBER);
assert.equal(blockedTest.saved.length, 0);
assert.ok(blockedTest.messages.some(x => x.message.includes('SCAN LOCAL FOLDER')));

const failed = fixture(); failed.capturePartialDownloadGrants();
const failedTest = simulatedDownload(failed, { failLast: true });
await failedTest.run(MODE.SUBSCRIBER);
assert.equal(failedTest.saved.length, 65);
assert.equal(failed.state.downloadProgress.succeeded, 64);
assert.equal(failed.state.downloadProgress.failed, 1);
assert.ok(failedTest.messages.some(x =>
    x.level === 'warn' && x.message.includes('64/65 physical writes succeeded')
));
console.log('Unified subscriber evidence grant, mode safety and download tests passed.');
