import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);

function extract(name) {
    let start = source.indexOf('    function ' + name + '(');
    if (start < 0) start = source.indexOf('    async function ' + name + '(');
    assert.ok(start >= 0, 'missing function: ' + name);
    const end = source.indexOf('\n    }\n', start);
    assert.ok(end > start, 'unterminated function: ' + name);
    return source.slice(start, end + 7);
}

const helpers = new Function(
    [
        'authenticatedMediaVisibility',
        'mediaArchiveCategory',
        'archiveDownloadPath',
    ].map(extract).join('\n') +
    '\nreturn { authenticatedMediaVisibility, mediaArchiveCategory, archiveDownloadPath };'
);
const { authenticatedMediaVisibility: visibility,
    mediaArchiveCategory: category,
    archiveDownloadPath: archivePath } = helpers();

const sources = (...xs) => new Set(xs);
const name = 'muat0ri - POST - 2025_05_01 - 123456.jpg';
const fan = {
    id: '123456', type: 'POST', filename: name,
    visibility: 'fan_club',
    sources: sources('CONNECTED_HIDDEN_AUTHORIZED'),
};
const hidden = {
    ...fan, visibility: '', sources: sources('CONNECTED_HIDDEN_AUTHORIZED'),
};
const publicPost = {
    ...fan, visibility: '', sources: sources('PROFILE_PUBLIC_SHADOW'),
};
const publicReel = {
    ...publicPost, type: 'REEL',
};
const explicitHiddenReel = {
    ...publicReel, visibility: 'hidden',
};
assert.equal(visibility({ subscription_media_visibility: 'fan_club' },
    'CONNECTED_HIDDEN_AUTHORIZED'), 'fan_club');
assert.equal(visibility({ subscription_media_visibility: 'fan_club' },
    'OWNED_DEEP_HYDRATION'), 'fan_club');
assert.equal(visibility({ subscription_media_visibility: 'fan_club' },
    'PROFILE_PUBLIC_SHADOW'), '', 'public/anonymous source is not authorization');
assert.equal(visibility({}, 'CONNECTED_HIDDEN_AUTHORIZED'), '');

assert.equal(category(fan), 'FAN CLUB');
assert.equal(category(hidden), 'HIDDEN');
assert.equal(category(publicPost), 'POSTS',
    'PUBLIC SHADOW must not automatically mean HIDDEN');
assert.equal(category(publicReel), 'REELS');
assert.equal(category(explicitHiddenReel), 'HIDDEN');

const pathFan = archivePath(fan, 'muat0ri');
const pathHidden = archivePath(hidden, 'muat0ri');
const pathPost = archivePath(publicPost, 'muat0ri');
const pathReel = archivePath(publicReel, 'muat0ri');
assert.equal(pathFan, 'muat0ri/muat0ri - FAN CLUB/' + name);
assert.equal(pathHidden, 'muat0ri/muat0ri - HIDDEN/' + name,
    'HIDDEN must remain a flat folder');
assert.equal(pathPost, 'muat0ri/muat0ri - POSTS/' + name);
assert.equal(pathReel, 'muat0ri/muat0ri - REELS/' + name);
assert.equal(pathHidden.split('/').length, 3);
assert.equal(pathFan.split('/').length, 3);
assert.notEqual(pathFan, pathPost);
assert.notEqual(pathFan, pathHidden);

const state = {
    diskCanonical: new Set(),
    diskCanonicalMeta: new Map(),
    diskLocations: new Map(),
    diskHidden: new Set(),
    diskStoryHighlight: new Set(),
    legacy: new Map(),
    diskActive: false,
    settings: { force: false },
    queue: new Map(),
};
const actions = new Function(
    'state', 'mediaArchiveCategory', 'updateStats', 'status', 'log',
    'legacyMatch', 'canonicalShortcode',
    [extract('indexFolder'), extract('existingReason'),
     extract('diskSatisfiesOwnedRoot'), extract('downloadOperationPlan'),
     extract('downloadOne')].join('\n') +
    '\nreturn { indexFolder, existingReason, diskSatisfiesOwnedRoot,' +
    'downloadOperationPlan, downloadOne };'
)(
    state, category, () => {}, () => {}, () => {},
    () => false, x => x
);
const file = (folder, id = '123456') => ({
    name: name.replace('123456', id),
    webkitRelativePath: 'muat0ri/muat0ri - ' + folder + '/' +
        name.replace('123456', id),
});
actions.indexFolder([file('POSTS'), file('HIDDEN')]);
assert.equal(state.diskCanonical.size, 1);
assert.deepEqual([...state.diskLocations.get('123456')].sort(),
    ['HIDDEN', 'POSTS']);
assert.equal(actions.existingReason(publicPost), 'DISK');
assert.equal(actions.existingReason(hidden), 'DISK');
assert.equal(actions.existingReason(fan), null,
    'the old POSTS/HIDDEN duplicate cannot satisfy FAN CLUB target');
assert.deepEqual(actions.downloadOperationPlan([fan]),
    { main: 1, hidden: 0, total: 1 });

const root = {
    type: 'POST', structureComplete: true,
    expectedUnits: 1, knownUnitIds: new Set(['123456']),
};
state.queue.set('123456', fan);
assert.equal(actions.diskSatisfiesOwnedRoot(root), false,
    'must not skip hydration when FAN CLUB file absent');
actions.indexFolder([file('POSTS'), file('HIDDEN'), file('FAN CLUB')]);
assert.equal(actions.existingReason(fan), 'DISK');
assert.equal(actions.diskSatisfiesOwnedRoot(root), true,
    'FAN CLUB file with matching type must satisfy the owned root');
assert.deepEqual(actions.downloadOperationPlan([fan]),
    { main: 0, hidden: 0, total: 0 });

const dispatch = new Function(
    'existingReason', 'downloadMainOne',
    extract('downloadOne') + '\nreturn downloadOne;'
);
const executed = [];
const downloadOne = dispatch(m => m.id === 'saved' ? 'SESSION' : null,
    async m => { executed.push(m.id); return true; });
await downloadOne({ id: 'new' });
await downloadOne({ id: 'saved' });
assert.deepEqual(executed, ['new'],
    'no hidden copy or second download operation');

assert.ok(!source.includes('async function downloadHiddenCopy('),
    'duplicate HIDDEN writer must be removed');
assert.ok(!source.includes('function recordHiddenDownloaded('));
assert.ok(!source.includes('hiddenCopy: true'));
assert.ok(source.includes('const confirmedVisibility = authenticatedMediaVisibility(root, source)'));
assert.ok(source.includes('m.visibility = old.visibility || m.visibility'));
assert.ok(source.includes('visibility: m.visibility || null'));
assert.ok(source.includes('archiveCategory: mediaArchiveCategory(m)'));
console.log('Single-copy FAN CLUB / flat HIDDEN archive routing tests passed.');
