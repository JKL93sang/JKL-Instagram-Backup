import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
const start = source.indexOf('    function indexFolder(files) {');
const end = source.indexOf('\n    function legacyMatch(',start);
assert.ok(start >= 0 && end > start);
const indexFolderSrc = source.slice(start,end);
const state = {
    diskCanonical:new Set(),
    diskCanonicalMeta:new Map(),
    diskLocations:new Map(),
    diskPaths:new Map(),
    sessionPaths:new Map(),
    diskHidden:new Set(),
    diskStoryHighlight:new Set(),
    legacy:new Map(),
    diskIndexStats:null,
    diskActive:false,
};
const statuses = [];
const logs = [];
const indexFolder = new Function(
    'state','updateStats','status','log','canonicalShortcode',
    'reportHighlightFolderRenames',
    indexFolderSrc + '\nreturn indexFolder;'
)(
    state, () => {},
    (...args) => statuses.push(args),
    (...args) => logs.push(args),
    x => x, () => {}
);

const name = 'muat0ri - POST - 2025_11_01 - 123456.jpg';
const file = (folder, name) => ({
    name, webkitRelativePath:'muat0ri/muat0ri - ' + folder + '/' + name,
});
indexFolder([
    file('POSTS',name),
    file('HIDDEN',name),
    file('FAN CLUB','muat0ri - REEL - 2025_10_01 - 654321.mp4'),
    { name:'muat0ri-photo-abc-20251108_010203-x.jpg',
      webkitRelativePath:'muat0ri/legacy/muat0ri-photo-abc-20251108_010203-x.jpg' },
    { name:'readme.txt',webkitRelativePath:'muat0ri/readme.txt' },
]);
assert.equal(state.diskActive,true);
assert.deepEqual(state.diskIndexStats,{
    selectedFiles:5, canonicalFiles:3,
    legacyFiles:1,unrecognizedFiles:1,
});
assert.equal(state.diskCanonical.size,2,'two unique IDs despite a HIDDEN duplicate');
assert.equal(state.diskHidden.size,1);
assert.equal(state.legacy.size,1);
assert.deepEqual([...state.diskLocations.get('123456')].sort(),['HIDDEN','POSTS']);
assert.deepEqual([...state.diskLocations.get('654321')],['FAN CLUB']);
assert.ok(statuses.some(x=>x[0].includes('5 files, 2 canonical IDs')));
assert.ok(statuses.some(x=>x[0].includes('1 unrecognized')));
assert.ok(logs.some(x=>x[0].includes('5 files, 2 canonical IDs')));
assert.ok(source.includes("? 'DISK INDEXED'"));
assert.ok(!source.includes("? 'DISK VERIFIED'"));
for(const key of ['selectedFiles','canonicalFiles','legacyFiles','unrecognizedFiles']) {
    assert.ok(source.includes('state.diskIndexStats.' + key),
        key + ' must be visible or maintained');
}
assert.ok(source.includes('Recognized files <b>'));
assert.ok(source.includes('Unrecognized <b>'));
console.log('Local archive indexing UX: 5 files, 2 IDs, HIDDEN/legacy/unknown passed.');
