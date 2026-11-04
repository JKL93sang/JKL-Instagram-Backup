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
    assert.ok(end > start, 'missing end of function ' + name);
    return source.slice(start, end + 7);
}

const methods = [
    'hiddenDiscoverySources',
    'scanDownloadFingerprint',
    'verifiedSubscriberMedia',
    'captureVerifiedSubscriberSnapshot',
    'verifiedSubscriberDownloadIntegrity',
    'cleanUser',
].map(extract).join('\n');

function fixture() {
    const state = {
        username: 'subscriber.test',
        userId: '710001',
        scanOutcome: 'INCOMPLETE',
        scanPlan: { post: true, reel: true },
        queue: new Map(),
        verifiedSubscriberRootIds: new Set(),
        verifiedSubscriberSnapshot: null,
        running: false,
        cancelled: false,
        feedbackRequired: false,
        rateLimited: false,
        apiUnhealthy: false,
        exclusive: { known: true, hasExclusiveFeedContent: true },
        coverage: {
            profileGrid: false,
            publicShadow: true,
            connectedHidden: true,
            ownedHydration: true,
        },
        hidden: {
            candidates: 65,
            recovered: 65,
            alreadyOwned: 0,
            previewOnly: 0,
            failed: 0,
        },
    };
    for (let i = 0; i < 65; i++) {
        const rootId = String(900000 + i);
        const id = String(1100000 + i);
        state.verifiedSubscriberRootIds.add(rootId);
        state.queue.set(id, {
            id, type: 'POST',
            filename: id + '.jpg',
            url: 'https://example.test/owned-' + id,
            sources: new Set(['CONNECTED_HIDDEN_AUTHORIZED']),
            rootIds: new Set([rootId]),
        });
    }

    // Anonymous and unverified media must never enter the partial subset.
    state.queue.set('public', {
        id: 'public', type: 'POST', filename: 'public.jpg',
        url: 'https://example.test/public',
        sources: new Set(['PROFILE_PUBLIC_SHADOW']),
        rootIds: new Set(['public-root']),
    });
    state.queue.set('unverified', {
        id: 'unverified', type: 'POST', filename: 'unverified.jpg',
        url: 'https://example.test/unverified',
        sources: new Set(['CONNECTED_HIDDEN_AUTHORIZED']),
        rootIds: new Set(['unverified-root']),
    });
    state.queue.set('preview-only', {
        id: 'preview-only', type: 'POST', filename: 'preview.jpg',
        url: 'https://example.test/preview',
        sources: new Set(['OTHER']),
        rootIds: new Set(['900000']),
    });

    const ui = { username: { value: 'subscriber.test' } };
    const logs = [];
    const hiddenSources = new Set([
        'PROFILE_PUBLIC_SHADOW',
        'CONNECTED_HIDDEN_AUTHORIZED',
    ]);
    const h = new Function(
        'state', 'ui', 'HIDDEN_DISCOVERY_SOURCES',
        'log', 'currentProfile',
        methods + '\nreturn { verifiedSubscriberMedia, ' +
        'captureVerifiedSubscriberSnapshot, verifiedSubscriberDownloadIntegrity };'
    )(
        state, ui, hiddenSources,
        (...args) => logs.push(args), () => 'subscriber.test'
    );
    return { state, ui, logs, ...h };
}

const f = fixture();
f.captureVerifiedSubscriberSnapshot();
assert.ok(f.state.verifiedSubscriberSnapshot);
assert.equal(f.state.verifiedSubscriberSnapshot.mediaCount, 65);
assert.equal(f.state.verifiedSubscriberRootIds.size, 65);
assert.equal(f.verifiedSubscriberMedia().length, 65);
assert.equal(f.verifiedSubscriberDownloadIntegrity().ok, true);
assert.equal(f.verifiedSubscriberDownloadIntegrity().media.length, 65);
assert.equal(f.state.scanOutcome, 'INCOMPLETE');
assert.equal(f.state.coverage.profileGrid, false);
assert.ok(f.logs.some(x => x[0].includes('PARTIAL READY')));

function rejectBeforeSnapshot(label, mutate) {
    const x = fixture();
    mutate(x);
    x.captureVerifiedSubscriberSnapshot();
    assert.equal(x.state.verifiedSubscriberSnapshot, null, label);
}
rejectBeforeSnapshot('complete scan uses standard mode', x => {
    x.state.scanOutcome = 'COMPLETE';
});
rejectBeforeSnapshot('unknown exclusive entitlement', x => {
    x.state.exclusive.known = false;
});
rejectBeforeSnapshot('nonexclusive profile', x => {
    x.state.exclusive.hasExclusiveFeedContent = false;
});
rejectBeforeSnapshot('post scan missing', x => {
    x.state.scanPlan.post = false;
});
rejectBeforeSnapshot('reel scan missing', x => {
    x.state.scanPlan.reel = false;
});
rejectBeforeSnapshot('preview-only candidate', x => {
    x.state.hidden.previewOnly = 1;
});
rejectBeforeSnapshot('unverified media-info', x => {
    x.state.hidden.failed = 1;
});
rejectBeforeSnapshot('discovery unfinished', x => {
    x.state.coverage.connectedHidden = false;
});
rejectBeforeSnapshot('hydration unfinished', x => {
    x.state.coverage.ownedHydration = false;
});
rejectBeforeSnapshot('candidate pagination incomplete', x => {
    x.state.hidden.candidates = 66;
});
rejectBeforeSnapshot('root registration missing', x => {
    x.state.verifiedSubscriberRootIds.delete('900000');
});
rejectBeforeSnapshot('Instagram rate-limit', x => {
    x.state.rateLimited = true;
});
rejectBeforeSnapshot('feedback_required', x => {
    x.state.feedbackRequired = true;
});
rejectBeforeSnapshot('API unhealthy', x => {
    x.state.apiUnhealthy = true;
});
rejectBeforeSnapshot('scan cancelled', x => {
    x.state.cancelled = true;
});

function rejectAfterSnapshot(label, mutate) {
    const x = fixture();
    x.captureVerifiedSubscriberSnapshot();
    assert.equal(x.verifiedSubscriberDownloadIntegrity().ok, true, label);
    mutate(x);
    assert.equal(x.verifiedSubscriberDownloadIntegrity().ok, false, label);
}
rejectAfterSnapshot('profile changed', x => {
    x.state.userId = 'different';
});
rejectAfterSnapshot('username changed', x => {
    x.ui.username.value = 'other.user';
});
rejectAfterSnapshot('queue grew', x => {
    x.state.queue.set('new', { id: 'new', type: 'POST' });
});
rejectAfterSnapshot('signed URL mutated', x => {
    x.state.queue.get('1100000').url += '?changed=1';
});
rejectAfterSnapshot('subscriber authorization mutated', x => {
    x.state.verifiedSubscriberRootIds.delete('900000');
});
rejectAfterSnapshot('source was altered', x => {
    x.state.queue.get('1100000').sources.delete('CONNECTED_HIDDEN_AUTHORIZED');
});
rejectAfterSnapshot('media root changed', x => {
    x.state.queue.get('1100000').rootIds.delete('900000');
});
rejectAfterSnapshot('hydration no longer valid', x => {
    x.state.coverage.ownedHydration = false;
});
rejectAfterSnapshot('stop due to feedback', x => {
    x.state.feedbackRequired = true;
});
rejectAfterSnapshot('stop due to rate-limit', x => {
    x.state.rateLimited = true;
});
rejectAfterSnapshot('scan retried', x => {
    x.state.scanOutcome = 'RUNNING';
});
rejectAfterSnapshot('candidate status changed', x => {
    x.state.hidden.previewOnly = 1;
});

const download = extract('downloadMissing');
assert.ok(download.includes('verifiedSubscriberDownloadIntegrity()'));
assert.ok(download.includes('completedScanIntegrity()'));
assert.ok(download.includes('if (!authorizedOnly)'));
assert.ok(download.includes('incompleteCoverage()'));
assert.ok(download.includes('mediaScope'));
assert.ok(download.includes('unverifiedArchiveHistory(mediaScope)'));
assert.ok(download.includes('scanIntegrity.media'));
assert.ok(download.includes('OVERALL PROFILE') === false);
assert.ok(source.includes('downloadVerifiedSubscriberPartial'));
assert.ok(source.includes('DOWNLOAD SUBSCRIBER VERIFIED (PARTIAL)'));
assert.ok(source.includes('ui.download.onclick =\n            () => downloadMissing(false)'));
assert.ok(source.includes('state.verifiedSubscriberRootIds.add(String(pk))'));
assert.ok(source.includes("source === 'OWNED_DEEP_HYDRATION'"));
assert.ok(source.includes('ownerId !== String(state.userId)'));
assert.ok(source.includes('queuedUnitsForRoot(pk)'));
assert.ok(source.includes('Overall PROFILE scan remains INCOMPLETE.'));
assert.ok(source.includes('physical writes succeeded'));
assert.ok(!source.includes("state.scanOutcome = 'COMPLETE';\n                captureVerifiedSubscriberSnapshot()"));


/*
 * Exercise the real downloadMissing control flow with a fake transport.
 * This test never contacts Instagram or downloads actual media.
 */
function simulatedRunner(x, { ledgerBlocked = false, failLast = false } = {}) {
    const saved = [];
    const seenScopes = [];
    const statuses = [];
    const record = {
        disabled: [],
        flushes: [],
    };
    const beginDownloadProgress = pending => {
        const main = pending.length;
        const hidden = pending.length;
        x.state.downloadProgress = {
            status: 'running', total: main + hidden,
            completed: 0, succeeded: 0, failed: 0,
            blocked: 0, current: '',
        };
        return { main, hidden, total: main + hidden };
    };
    const downloadOne = async m => {
        saved.push(m.id);
        const p = x.state.downloadProgress;
        p.completed += 2;
        if (failLast && saved.length === 65) {
            p.succeeded += 0;
            p.failed++;
            p.blocked++;
        } else {
            p.succeeded += 2;
        }
        return true;
    };
    const run = new Function(
        'state', 'status', 'log',
        'verifiedSubscriberDownloadIntegrity',
        'completedScanIntegrity', 'incompleteCoverage',
        'unverifiedArchiveHistory', 'disable', 'existingReason',
        'isHiddenMedia', 'hiddenCopyExistingReason',
        'beginDownloadProgress', 'APP', 'sleep',
        'downloadOne', 'updateStats', 'flushLedger',
        extract('downloadMissing') + '\nreturn downloadMissing;'
    )(
        x.state,
        (message, level) => statuses.push({ message, level }),
        (...parts) => x.logs.push(parts),
        x.verifiedSubscriberDownloadIntegrity,
        () => ({ ok: false, reason: 'PROFILE is not complete' }),
        () => ['PROFILE grid'],
        records => {
            seenScopes.push([...records].map(m => m.id));
            return ledgerBlocked
                ? { total: 1, ledger: 1 }
                : { total: 0, ledger: 0 };
        },
        disabled => record.disabled.push(disabled),
        () => null,
        m => m.sources.has('CONNECTED_HIDDEN_AUTHORIZED'),
        () => null,
        beginDownloadProgress,
        { DOWNLOAD_WORKERS: 1, DOWNLOAD_DELAY: 0, DOWNLOAD_RETRIES: 3 },
        async () => {},
        downloadOne,
        () => {},
        value => record.flushes.push(value),
    );
    return { run, saved, seenScopes, statuses, record };
}

const x = fixture();
x.captureVerifiedSubscriberSnapshot();
const simulate = simulatedRunner(x);
await simulate.run(false);
assert.equal(simulate.saved.length, 0,
    'normal download must remain blocked on an incomplete PROFILE');
assert.ok(simulate.statuses.some(e => e.message.includes('PROFILE is not complete')));
await simulate.run(true);
assert.equal(simulate.saved.length, 65,
    'partial download must dispatch only verified media');
assert.ok(!simulate.saved.includes('public'));
assert.ok(!simulate.saved.includes('unverified'));
assert.ok(!simulate.saved.includes('preview-only'));
assert.equal(simulate.seenScopes[0].length, 65);
assert.equal(x.state.downloadProgress.succeeded, 130);
assert.equal(x.state.downloadProgress.failed, 0);
assert.equal(x.state.scanOutcome, 'INCOMPLETE');
assert.equal(x.state.downloading, false);
assert.deepEqual(simulate.record.disabled, [true, false]);
assert.deepEqual(simulate.record.flushes, [true]);
assert.ok(simulate.statuses.some(e => e.message.includes('PARTIAL')));

const blocked = fixture();
blocked.captureVerifiedSubscriberSnapshot();
const blockedRun = simulatedRunner(blocked, { ledgerBlocked: true });
await blockedRun.run(true);
assert.equal(blockedRun.saved.length, 0,
    'historical ledger must not bypass local-folder verification');
assert.equal(blockedRun.seenScopes[0].length, 65);

const failed = fixture();
failed.captureVerifiedSubscriberSnapshot();
const failedRun = simulatedRunner(failed, { failLast: true });
await failedRun.run(true);
assert.equal(failedRun.saved.length, 65);
assert.equal(failed.state.downloadProgress.succeeded, 128);
assert.equal(failed.state.downloadProgress.failed, 1);
assert.equal(failed.state.downloadProgress.blocked, 1);
assert.ok(failedRun.statuses.some(e =>
    e.level === 'warn' &&
    e.message.includes('128/130 physical writes succeeded')
));

console.log('Subscriber-authorized partial backup safety regression tests passed.');
