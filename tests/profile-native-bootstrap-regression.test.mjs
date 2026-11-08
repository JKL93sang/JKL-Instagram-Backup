import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const m = source.match(new RegExp('    (?:async )?function ' + name + '\\('));
    assert.ok(m, 'missing implementation: ' + name);
    const end = source.indexOf('\n    }\n', m.index);
    assert.ok(end >= m.index, 'missing end: ' + name);
    return source.slice(m.index, end + 7);
}
function fixture() {
    const net = {
        gridByUser: new Map(),
        gridPageInfo: new Map(),
        gridDocByUser: new Map(),
        gridQueryByUser: new Map(),
        gridNativeAuditByUser: new Map(),
        gridNativeContinuationByUser: new Map(),
        gridNativeInitialByUser: new Map(),
        gridCaptureSeenAtByUser: new Map(),
        gridBootstrapConsumedByUser: new Set(),
    };
    const state = { username: 'jennnii97', cancelled: false };
    const APP = { PROFILE_BOOTSTRAP_MAX_AGE_MS: 20000 };
    const functions = new Function(
        'net', 'state', 'APP', 'cleanUser',
        'location', 'pathNorm', 'waitForFreshProfileGridCapture',
        'findAnchor', 'go', 'waitPath', 'sleep', 'history',
        extract('prepareProfileNativeEvidenceForScan') +
        extract('primeProfileGridNativeCapture') +
        extract('profileCompletionRequirement') +
        '\nreturn { prepareProfileNativeEvidenceForScan, ' +
        'primeProfileGridNativeCapture, profileCompletionRequirement };'
    )(
        net, state, APP, x => String(x || '').replace(/^@/, ''),
        { pathname: '/jennnii97/' },
        p => String(p).replace(/\/+$/, ''),
        async () => ({ captured: false }),
        () => null,
        async () => { throw Error('must not navigate without verified anchor'); },
        async () => false,
        async () => {},
        { back() {} },
    );
    return { net, state, APP, ...functions };
}
function seed(x, now, {
    age = 1000, user = 'jennnii97', roots = 1,
    initial = 1, hasNext = false,
} = {}) {
    x.net.gridCaptureSeenAtByUser.set(user, now - age);
    x.net.gridByUser.set(user, new Map(
        Array.from({ length: roots }, (_, i) => [String(i + 1), { pk: i + 1 }])
    ));
    x.net.gridPageInfo.set(user, { has_next_page: hasNext });
    x.net.gridNativeAuditByUser.set(user, {
        initial, continuation: 0,
        cursorLocation: 'absent', lastHasNext: String(hasNext),
    });
    x.net.gridNativeInitialByUser.set(user, { docId: '123' });
}
const now = 1800000000000;

// A hook at document-start already captured the initial page. The scan
// must use it rather than erase it after refreshProfileInfo().
{
    const x = fixture();
    seed(x, now);
    const evidence = x.prepareProfileNativeEvidenceForScan('jennnii97', now);
    assert.equal(evidence.retained, true);
    assert.equal(evidence.roots, 1);
    assert.equal(evidence.pageInfo.has_next_page, false);
    assert.equal(x.net.gridByUser.get('jennnii97').size, 1);
    assert.equal(x.net.gridNativeInitialByUser.get('jennnii97').docId, '123');
    const prime = await x.primeProfileGridNativeCapture('/jennnii97/');
    assert.equal(prime.captured, true);
    assert.equal(prime.method, 'already-fresh');
    assert.equal(x.profileCompletionRequirement({
        primeCaptured: true, nativeEnded: true, nativeOwned: 1, expected: 1,
    }).required, false);
    assert.equal(x.profileCompletionRequirement({
        primeCaptured: true, nativeEnded: true, nativeOwned: 1, expected: 2,
    }).required, true, 'out-of-date server count cannot be ignored');
    const reused = x.prepareProfileNativeEvidenceForScan('jennnii97', now + 1000);
    assert.equal(reused.retained, false, 'bootstrap evidence is single-use');
    assert.equal(x.net.gridByUser.get('jennnii97').size, 0);
}
for (const [label, opts] of [
    ['stale server response', { age: 20001 }],
    ['native cursor without initial', { initial: 0 }],
    ['missing server end', { hasNext: null }],
    ['clock mismatch', { age: -20 }],
]) {
    const x = fixture();
    seed(x, now, opts);
    assert.equal(x.prepareProfileNativeEvidenceForScan('jennnii97', now).retained,
        false, label);
    assert.equal(x.net.gridByUser.get('jennnii97').size, 0);
    assert.equal(x.net.gridPageInfo.has('jennnii97'), false);
}
{
    const x = fixture();
    seed(x, now, { user: 'different.account' });
    assert.equal(x.prepareProfileNativeEvidenceForScan('jennnii97', now).retained,
        false, 'a different account cannot provide target data');
    assert.equal(x.net.gridByUser.get('different.account').size, 1);
    const prime = await x.primeProfileGridNativeCapture('/jennnii97/');
    assert.equal(prime.captured, false);
    assert.equal(prime.method, 'no-native-reentry-route',
        'missing REELS and TAGGED anchors must be reported explicitly');
    assert.equal(prime.attempted, false);
}
{
    const x = fixture();
    seed(x, now, { hasNext: true });
    assert.equal(x.prepareProfileNativeEvidenceForScan('jennnii97', now).retained,
        true, 'an initial page with a cursor remains usable evidence');
    assert.equal(x.profileCompletionRequirement({
        primeCaptured: true, nativeEnded: false, nativeOwned: 1, expected: 1,
    }).required, true, 'a missing pagination end must remain incomplete');
}
const scanAll = source.slice(
    source.indexOf('    async function scanAll() {'),
    source.indexOf('\n    function indexFolder(', source.indexOf('    async function scanAll() {'))
);
assert.ok(scanAll.includes('prepareProfileNativeEvidenceForScan('));
assert.ok(scanAll.includes('nativeBootstrap.retained'));
assert.ok(!scanAll.includes('net.gridPageInfo.delete('),
    'scanAll must not independently erase the captured native proof');
assert.ok(source.includes('net.gridCaptureSeenAtByUser.set(user, Date.now())'));
console.log('Fresh identity-scoped PROFILE bootstrap preserved; stale, repeated and missing-route cases blocked.');
