import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const match = source.match(new RegExp('    (?:async )?function ' + name + '\\('));
    assert.ok(match, 'missing real implementation: ' + name);
    const end = source.indexOf('\n    }\n', match.index);
    assert.ok(end >= match.index, 'unclosed function: ' + name);
    return source.slice(match.index, end + 7);
}
const reelIds = [
    '18000000000000001', '18000000000000002',
    '18000000000000003', '18000000000000004',
];
const counts = [50, 92, 17, 17];
const username = 'jennnii97';
const state = {
    username, userId: '45790055326', cancelled: false,
    coverage: { highlights: false },
    highlightCatalog: new Map(), queue: new Map(),
    diskCanonical: new Set(), diskCanonicalMeta: new Map(),
    diskLocations: new Map(), diskPaths: new Map(), sessionPaths: new Map(),
    diskHidden: new Set(), diskStoryHighlight: new Set(), legacy: new Map(),
    settings: { force: false }, diskActive: false,
};
const logs = [], writeRequests = [];
const helpers = [
    'sanitizePathComponent', 'hiId', 'highlightFolderName',
    'buildHighlightCatalog', 'highlightFolderTitle',
    'highlightFallbackFolderTitle', 'mediaArchiveCategory',
    'archiveDownloadPath', 'matchesHighlightArchivePath',
    'scanHighlights', 'indexFolder', 'existingReason',
    'downloadAttempt',
].map(extract).join('\n');

const testApi = new Function(
    'state', 'APP', 'getHighlightTrayWeb', 'highlightTrayConn',
    'edgeNode', 'setScanProgressPhase', 'log', 'status',
    'fetchWebStoryReel', 'throwIfInstagramStop', 'addMedia',
    'updateStats', 'sleep', 'rand',
    'filename', 'canonicalShortcode', 'legacyMatch', 'GM_download',
    helpers + '\nreturn { highlightFolderName, buildHighlightCatalog, ' +
        'archiveDownloadPath, matchesHighlightArchivePath, scanHighlights, ' +
        'indexFolder, existingReason, downloadAttempt };'
)(
    state,
    { PAGE_MIN: 0, PAGE_MAX: 0 },
    async () => ({
        data: {
            edges: reelIds.map(id => ({ node: { id: 'highlight:' + id, title: '.' } })),
            page_info: { has_next_page: false },
        },
        source: 'graphql',
    }),
    d => d,
    edge => edge.node,
    () => {},
    (...args) => logs.push(args),
    () => {},
    async expected => {
        const reelId = expected.slice('highlight:'.length);
        const idx = reelIds.indexOf(reelId);
        assert.ok(idx !== -1, 'only target-scoped reel requests');
        return [{
            id: 'highlight:' + reelId,
            items: Array.from({ length: counts[idx] }, (_, i) => ({
                pk: String(900000000000 + idx * 100000 + i),
            })),
        }];
    },
    e => { throw e; },
    (raw, type, tag, context) => {
        assert.equal(type, 'HIGHLIGHT');
        assert.ok(context && reelIds.includes(context.highlightId),
            'the real scan must pass the immutable reel ID to addMedia');
        assert.equal(tag, 'HIGHLIGHT_REEL:' + context.highlightId);
        const id = raw.pk;
        const m = {
            id, type, highlightId: context.highlightId,
            highlightIds: new Set([context.highlightId]),
            sources: new Set([tag]),
            filename: username + ' - HIGHLIGHT - 2026_11_08 - ' + id + '.jpg',
            url: 'https://example.test/' + id,
        };
        state.queue.set(id, m);
    },
    () => {}, async () => {}, () => 0,
    m => m.filename,
    x => x, () => false,
    options => {
        writeRequests.push(options);
        queueMicrotask(() => options.onload());
    }
);

const success = await testApi.scanHighlights();
assert.equal(success, true, 'all four verified reels must complete');
assert.equal(state.highlightCatalog.size, 4);
assert.equal(state.queue.size, 176, '50+92+17+17 distinct files');
assert.deepEqual(
    [...state.highlightCatalog.values()].map(x => x.title),
    ['.', '.', '.', '.']
);
const byFolder = new Map();
for (const media of state.queue.values()) {
    const path = testApi.archiveDownloadPath(media);
    const folder = path.split('/').at(-2);
    assert.ok(folder.includes('[' + media.highlightId + ']'));
    byFolder.set(folder, (byFolder.get(folder) || 0) + 1);
}
assert.deepEqual([...byFolder.values()], counts,
    'four distinct folders with independent 50/92/17/17 files');
assert.equal(byFolder.size, 4);
assert.ok(logs.filter(x => String(x[0]).includes('folder=')).length === 4);

const first = [...state.queue.values()][0];
const pathFirst = testApi.archiveDownloadPath(first);
assert.equal(pathFirst.split('/').length, 4,
    'profile/category/reel folder/file');
const alternate = testApi.archiveDownloadPath(first, username, {
    safeHighlightFallback: true,
});
assert.notEqual(alternate, pathFirst);
assert.ok(alternate.includes('HL_' + first.highlightId));
assert.equal(testApi.matchesHighlightArchivePath(first, alternate), true);
const receipt = await testApi.downloadAttempt(first);
assert.equal(receipt.requestedPath, pathFirst);
assert.equal(writeRequests[0].name, pathFirst,
    'GM_download must get the complete nested filename');
assert.equal(writeRequests[0].conflictAction, 'overwrite');

// The previous script put all titles "." into a single folder. Files
// there must NOT be accepted as satisfying the corrected directory path.
const oldPath = [
    username, username + ' - HIGHLIGHTS',
    username + ' - Highlight', first.filename,
].join('/');
assert.equal(testApi.matchesHighlightArchivePath(first, oldPath), false);
assert.equal(testApi.matchesHighlightArchivePath(first, pathFirst), true);
const indexedFile = rel => ({
    name: first.filename, webkitRelativePath: rel,
});
testApi.indexFolder([indexedFile(oldPath)]);
assert.equal(testApi.existingReason(first), null,
    'a file in the obsolete shared folder must be eligible for repair');
// Once the repair has succeeded, avoid another transfer in the same session
// although the last physical directory scan still saw the obsolete path.
state.sessionPaths.set(first.id, new Set([pathFirst]));
assert.equal(testApi.existingReason(first), 'SESSION',
    'a successfully repaired highlight must not be downloaded twice');
testApi.indexFolder([indexedFile(pathFirst)]);
assert.equal(testApi.existingReason(first), 'DISK',
    'a correctly indexed highlight must never be needlessly re-downloaded');
testApi.indexFolder([indexedFile('Downloads/' + pathFirst)]);
assert.equal(testApi.existingReason(first), 'DISK',
    'the selected folder may be an ancestor of the profile directory');

// Plain or near-identical titles and long usernames must never collide.
assert.notEqual(
    testApi.highlightFolderName('Voyage', reelIds[0]),
    testApi.highlightFolderName('voyage', reelIds[1])
);
assert.notEqual(
    testApi.highlightFolderName('.', reelIds[0]),
    testApi.highlightFolderName('...', reelIds[1])
);
const long = 'a'.repeat(64);
const longMedia = { ...first, highlightId: reelIds[0] };
const longPath = testApi.archiveDownloadPath(longMedia, long);
assert.ok(longPath.includes('[' + reelIds[0] + ']'),
    'long user names cannot truncate the identity suffix');
assert.ok(longPath.split('/').at(-2).length <= 120);
assert.ok(source.includes("state.highlightCatalog = buildHighlightCatalog(tray)"));
assert.ok(source.includes('state.diskPaths.get(id)'));
assert.ok(source.includes('GM_info?.downloadMode'));

console.log(
    'Four same-title highlights kept distinct (50/92/17/17); path repair, ' +
    'file indexing and GM_download naming passed.'
);
