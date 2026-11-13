import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const pos=src.indexOf('    function '+name+'(');
    assert.ok(pos>=0,'Missing production function: '+name);
    const end=src.indexOf('\n    }\n',pos);
    assert.ok(end>pos);
    return src.slice(pos,end+7);
}

// Execute the REAL production scroll helper with synthetic geometry.
const next=new Function(extract('profileScrollTarget')+
    '\nreturn profileScrollTarget;')();
assert.equal(next(0,10000,1000),800,'must not teleport to page bottom');
assert.equal(next(800,10000,1000),1600);
assert.equal(next(8700,10000,1000),9000,'clamp to actual bottom');
assert.equal(next(9000,10000,1000),9000);
assert.equal(next(-20,10000,1000),800);
assert.equal(next(0,400,1000),0,'short profile stays on page');
assert.equal(next(100,1000,1),101,'tiny viewport still progresses');

let current=0;
const positions=[current];
while(current<9000) {
    const updated=next(current,10000,1000);
    assert.ok(updated>current);
    assert.ok(updated-current<=800,'no skipped full viewport');
    current=updated;
    positions.push(current);
    assert.ok(positions.length<100);
}
assert.equal(current,9000);
assert.match(src,/profileScrollTarget\(\s*window\.scrollY, documentHeight, viewport\s*\)/);
assert.match(src,/if \(nextY < bottom - 20\)/);
assert.match(src,/await waitForProfileGridProgress\(progressBaseline\)/,
    'the native server/height wait must remain at the actual bottom');
assert.match(src,/PROFILE grid stalled at the visual bottom without/);
assert.match(src,/PROFILE completion: no verified native continuation/);

// A tab-verified REEL can exist without a native Web Relay capture.
// Its own REEL_DOM verification must count in the READ-ONLY historical
// comparison, but must NOT become a native-pagination or PROFILE proof.
const state={
    username:'synthetic',userId:'42',expected:3,
    profileMainGridRootIds:new Set(['101']),
    profileDomObservedRootIds:new Set(['101']),
    reelsTabObservedRootIds:new Set(['103']),
    queue:new Map([['901',{}],['903',{}]]),
};
const net={
    gridByUser:new Map(),
    reelsByUserId:new Map(),
};
let captured;
const audit=new Function('state','net','loadDb','scanSelected',
    'reconcileHistoricalProfileRoots',
    extract('profileHistoricalRootAudit')+
    '\nreturn profileHistoricalRootAudit;'
)(state,net,()=>({profiles:{42:{media:{}}}}),
    key=>key==='post'||key==='reel',
    input=>{captured=input;return {kind:'DIAGNOSTIC_ONLY'};});
assert.equal(audit().kind,'DIAGNOSTIC_ONLY');
assert.deepEqual(captured.main,['101']);
assert.deepEqual(captured.reels,['103'],
    'REELS DOM-only root is not silently dropped without a native hook');
assert.deepEqual(captured.dom,['101']);
assert.deepEqual(captured.currentMediaIds,['901','903']);
assert.equal(captured.selectedPost,true);
assert.equal(captured.selectedReel,true);
assert.deepEqual([...state.profileMainGridRootIds],['101'],
    'independent REELS roots cannot mutate main PROFILE membership');
assert.match(src,/state\.reelsTabObservedRootIds = new Set\(\s*\[\.\.\.seenDom\.keys\(\)\]\.filter\(id => state\.roots\.REEL\.has\(id\)\)/,
    'only resolved, actually observed REELS DOM may enter the diagnostic');
assert.match(src,/state\.reelsTabObservedRootIds = new Set\(\);/,
    'each scan must reset the source-scoped snapshot');
assert.match(src,/PROFILE HISTORICAL AUDIT \(read-only\)/);
assert.match(src,/No coverage or archive changes\./);
assert.equal(src.match(/\/\/ @version\s+([0-9.]+)/)?.[1],'1.5.115');
console.log('Progressive PROFILE scroll, tab-scoped verified REEL DOM evidence, immutable audit: PASS');
