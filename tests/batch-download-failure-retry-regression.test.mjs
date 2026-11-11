import fs from 'node:fs';
import assert from 'node:assert/strict';

// Exercises the real production batch/controller functions against synthetic
// GM_download receipts. No Instagram request, filesystem write, or browser needed.
const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);

function production(name) {
    const marker = new RegExp('    (?:async )?function ' + name + '\\(');
    const start = marker.exec(source);
    assert.ok(start, 'production function missing: ' + name);
    const end = source.indexOf('\n    }\n', start.index);
    assert.ok(end > start.index, 'production function incomplete: ' + name);
    return source.slice(start.index, end + 7);
}

const names = [
    'downloadOperationPlan', 'resetDownloadProgress',
    'beginDownloadProgress', 'markDownloadOperation',
    'downloadMainOne', 'downloadOne', 'downloadMissing'
];

const executed = new Function('ctx', `
    const {
        APP, DOWNLOAD_MODE, DOWNLOAD_MODE_LABEL, state,
        existingReason, authorizeDownloadScope, unverifiedArchiveHistory,
        status, log, disable, updateStats, sleep, rand, downloadAttempt,
        archiveDownloadPath, mediaArchiveCategory, recordDownloaded, flushLedger, performance
    } = ctx;
    ${names.map(production).join('\n')}
    return {downloadMissing, resetDownloadProgress};
`);

const N = 129;
const missingId = '128'; // exactly one failing item, deterministic
const items = Array.from({length:N}, (_, i) => ({
    id: String(i + 1),
    filename: String(i + 1) + '.jpg',
    type: 'POST',
    url: 'https://cdn.example.test/' + (i + 1) + '.jpg',
}));
const statuses = [], logs = [], ledger = [], attempted = new Map();
let allowRecovery = false, flushCount = 0;
const state = {
    username: 'synthetic',
    running: false, downloading: false, cancelled: false,
    queue: new Map(items.map(x => [x.id, x])),
    downloaded: 0, failed: 0, diskActive: false,
    diskCanonical: new Set(), diskLocations: new Map(),
    sessionPaths: new Map(), downloadProgress: null,
};

const ctx = {
    APP: {DOWNLOAD_RETRIES: 3, DOWNLOAD_WORKERS: 1, DOWNLOAD_DELAY: 0},
    DOWNLOAD_MODE: {COMPLETE: 'COMPLETE'},
    DOWNLOAD_MODE_LABEL: {COMPLETE: 'Full archive'},
    state,
    existingReason: m => state.diskCanonical.has(String(m.id)) ? 'disk' : '',
    authorizeDownloadScope: () => ({ok: true, media: items}),
    unverifiedArchiveHistory: () => ({total: 0, ledger: 0}),
    status: (message, level) => statuses.push({message, level}),
    log: (message, level) => logs.push({message, level}),
    disable: () => {},
    updateStats: () => {},
    sleep: async () => {},
    rand: () => 0,
    performance,
    archiveDownloadPath: m => 'synthetic/POSTS/' + m.filename,
    mediaArchiveCategory: () => 'POSTS',
    recordDownloaded: m => ledger.push(m.id),
    flushLedger: () => {flushCount++;},
    downloadAttempt: async m => {
        attempted.set(m.id, (attempted.get(m.id) || 0) + 1);
        if (m.id === missingId && !allowRecovery)
            throw new Error('not_succeeded');
        return {requestedPath: 'synthetic/POSTS/' + m.filename};
    },
};
const app = executed(ctx);
app.resetDownloadProgress();
await app.downloadMissing();

assert.equal(state.downloaded, 128);
assert.equal(state.failed, 1);
assert.equal(state.diskCanonical.size, 128);
assert.equal(state.diskCanonical.has(missingId), false,
    'failed write cannot be registered as disk-present');
assert.equal(ledger.length, 128,
    'failed write cannot be added to the successful ledger');
assert.equal(attempted.get(missingId), 3,
    'failed download must exhaust configured retry budget');
assert.equal(state.downloadProgress.total, 129);
assert.equal(state.downloadProgress.completed, 129);
assert.equal(state.downloadProgress.succeeded, 128);
assert.equal(state.downloadProgress.failed, 1);
assert.equal(state.downloadProgress.status, 'complete');
assert.ok(logs.some(x => x.message.includes('129 media jobs processed') &&
    x.message.includes('128/129 physical writes succeeded') &&
    x.message.includes('1 failed') && x.level === 'warn'));
assert.ok(statuses.some(x => x.message.includes('1 failed') &&
    x.level === 'warn'), 'UI cannot claim all writes succeeded');
assert.equal(flushCount, 1);

const previousSuccessAttempts = new Map(attempted);
allowRecovery = true;
await app.downloadMissing();

assert.equal(state.downloaded, 129);
assert.equal(state.diskCanonical.size, 129);
assert.equal(ledger.length, 129);
assert.equal(attempted.get(missingId), 4);
assert.ok(items.filter(m => m.id !== missingId).every(
    m => attempted.get(m.id) === previousSuccessAttempts.get(m.id)
), 'retry must not re-download the other 128 successful files');
assert.equal(state.downloadProgress.total, 1);
assert.equal(state.downloadProgress.succeeded, 1);
assert.equal(state.downloadProgress.failed, 0);
assert.ok(statuses.some(x => x.message.includes('1/1 physical writes succeeded') &&
    x.message.includes('0 failed') && x.level === 'ok'));
assert.equal(flushCount, 2);

console.log('Batch download truthful summary / one-failure retry: OK');
