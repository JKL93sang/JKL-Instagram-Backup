import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url), 'utf8'
);
function extract(name) {
    const m = new RegExp('    (?:async )?function ' + name + '\\(').exec(source);
    assert.ok(m, 'missing production function ' + name);
    const end = source.indexOf('\n    }\n', m.index);
    assert.ok(end > m.index, 'function missing trailing boundary ' + name);
    return source.slice(m.index, end + 7);
}

// The proof model is pure and independent from Instagram traffic.
const classify = new Function(
    extract('classifyReelsEvidence') + '\nreturn classifyReelsEvidence;'
)();
const base = {
    selected:true, proven:false, nativeTab:false, knownClips:false,
    publicGridVerified:true, connectedHiddenVerified:true,
    ownedHydrationVerified:true, exclusiveKnown:true, exclusiveAvailable:false,
};
assert.deepEqual(classify({...base,selected:false}), {
    kind:'NOT_SELECTED',reason:'selection_off',
});
assert.deepEqual(classify({...base,proven:true}), {
    kind:'PROVEN',reason:'independent_reels_server_proof',
});
assert.equal(classify({...base,nativeTab:true}).kind,'UNVERIFIED');
assert.equal(classify({...base,knownClips:true}).kind,'UNVERIFIED');
assert.deepEqual(classify(base), {
    kind:'NOT_EXPOSED',
    reason:'no_native_reels_tab_and_no_explicit_zero_metadata',
});
for (const [name, mutate] of [
    ['profile grid unknown', {publicGridVerified:false}],
    ['hidden candidates unknown', {connectedHiddenVerified:false}],
    ['hydration unknown', {ownedHydrationVerified:false}],
    ['exclusive unknown', {exclusiveKnown:false}],
    ['exclusive reported', {exclusiveAvailable:true}],
]) {
    assert.equal(classify({...base,...mutate}).kind,'UNKNOWN',name);
}

// Integration: empty-tab never becomes a zero-clips proof from grid count,
// even if all independently visible surfaces have finished.
function classifyScenario({hasTab=false,known=0,apiProof=false}={}) {
    const uid='45790055326', logs=[], state={
        userId:uid,username:'jennnii97',
        profileInfo:{pk:uid,is_private:false,media_count:1},
        coverage:{
            profileGrid:true,publicShadow:true,connectedHidden:true,
            ownedHydration:true,reels:false,
        },
        roots:{REEL:new Set()},
        shadow:{reelIds:new Set(),reelsEvidence:null},
        hidden:{failed:0,previewOnly:0},
        exclusive:{known:true,hasExclusiveFeedContent:false},
        reelsDiagnosis:{kind:'NOT_SCANNED'},
    };
    if (known) state.profileInfo.total_clips_count=known;
    const net={reelsByUserId:new Map([[uid,new Map()]])};
    const rec=new Function('state','net','scanSelected',
        'explicitEmptyReelsProof','verifiedPublicGridPrimaryProof',
        'pathNorm','location','findAnchor','log',
        extract('classifyReelsEvidence') +
        extract('reconcileEmptyReelsCoverage') +
        '\nreturn reconcileEmptyReelsCoverage;'
    )(state,net,key=>key==='reel',
        () => apiProof
            ? {verified:true,source:'authenticated_user_info_total_clips_count'}
            : {verified:false,reason:'clips_absence_not_explicitly_reported'},
        () => ({verified:true}),
        x=>String(x).replace(/\\/+$/,''),
        {pathname:'/jennnii97/'},
        () => hasTab?{}:null,
        (message,severity) => logs.push({message,severity}),
    );
    rec();
    return {state,logs};
}
{
    const {state,logs}=classifyScenario();
    assert.equal(state.coverage.reels,false);
    assert.equal(state.reelsDiagnosis.kind,'NOT_EXPOSED');
    assert.ok(logs.some(x=>x.message.includes('No speculative REELS requests')));
}
{
    const {state}=classifyScenario({apiProof:true});
    assert.equal(state.coverage.reels,true);
    assert.equal(state.reelsDiagnosis.kind,'PROVEN');
}
{
    const {state}=classifyScenario({hasTab:true});
    assert.equal(state.coverage.reels,false);
    assert.equal(state.reelsDiagnosis.kind,'UNVERIFIED');
}
{
    const {state}=classifyScenario({known:2});
    assert.equal(state.coverage.reels,false);
    assert.equal(state.reelsDiagnosis.kind,'UNVERIFIED');
}

// Server session errors are recognized on actual CONTROL fields, not
// arbitrary user captions. No network call is involved in these tests.
const authChallenge = new Function(
    extract('instagramAuthChallengeIn') +
    '\nreturn instagramAuthChallengeIn;'
)();
for (const token of [
    'login_required','challenge_required',
    'checkpoint_required','checkpoint_challenge_required',
    'consent_required','user_has_logged_out',
]) {
    assert.equal(authChallenge({status:'fail',message:token}),true,token);
}
assert.equal(authChallenge(JSON.stringify({
    errors:[{error_type:'challenge_required'}],
})),true);
assert.equal(authChallenge({
    status:'ok',items:[{caption:{text:'login_required'}}],
}),false,'user-owned media text must not trigger a false circuit');
assert.equal(authChallenge('<html>login_required</html>'),false);
assert.equal(authChallenge({status:'ok',message:'ok'}),false);

// Exercise the *actual* GM request wrapper. After feedback_required,
// 429 or a checkpoint, a second attempted call must dispatch NO network.
function gmScenario(reply) {
    const state={
        running:true,cancelled:false,scanComplete:false,scanOutcome:'RUNNING',
        feedbackRequired:false,feedbackMessage:'',rateLimited:false,
        rateLimitMessage:'',apiUnhealthy:false,apiUnhealthyMessage:'',
    };
    let networkCalls=0;
    const gm=opts => {
        networkCalls++;
        opts.onload({status:reply.status, responseText:reply.body,
            responseHeaders:'content-type: application/json'});
    };
    const create=new Function('state','GM_xmlhttpRequest',
        extract('feedbackRequiredIn') +
        extract('instagramAuthChallengeIn') +
        extract('feedbackCircuitBreak') +
        extract('rateLimitCircuitBreak') +
        extract('apiUnhealthyError') +
        extract('gmRequest') +
        '\nreturn gmRequest;');
    const request=create(state,gm);
    return {request,state,calls:()=>networkCalls};
}
for (const [type, reply, flag] of [
    ['feedback',{status:200,body:'{"message":"feedback_required"}'},'feedbackRequired'],
    ['rate limit',{status:429,body:'{"status":"fail"}'},'rateLimited'],
    ['checkpoint',{status:200,body:'{"message":"challenge_required"}'},'apiUnhealthy'],
]) {
    const x=gmScenario(reply);
    await assert.rejects(x.request({
        method:'GET',url:'https://www.instagram.com/api/v1/users/1/info/',
    }), undefined, type+' initial denial');
    assert.equal(x.state[flag],true,type);
    assert.equal(x.calls(),1,type);
    await assert.rejects(x.request({
        method:'GET',url:'https://www.instagram.com/api/v1/users/1/info/',
    }), undefined, type+' repeat must be blocked');
    assert.equal(x.calls(),1,type+' no second transport dispatch');
}
{
    const x=gmScenario({status:200,
        body:'{"status":"ok","caption":"login_required"}'});
    await x.request({
        method:'GET',url:'https://www.instagram.com/api/v1/users/1/info/',
    });
    assert.equal(x.state.apiUnhealthy,false);
    assert.equal(x.calls(),1);
}

// Authenticated media-info must not spray the same request at 2 domains
// across 3 retries after a server access denial.
function mediaInfoScenario(status) {
    let calls=0, sleeps=0;
    const app={HYDRATE_RETRIES:3,MOBILE_UA:'test',APP_ID:'test'};
    const state={cancelled:false};
    const create=new Function(
        'APP','state','gmRequest','feedbackRequiredIn','feedbackCircuitBreak',
        'throwIfInstagramStop','apiUnhealthyError','rateLimitCircuitBreak',
        'sleep','rand',
        extract('fetchOwnedMediaInfo')+'\nreturn fetchOwnedMediaInfo;'
    );
    const load=create(
        app,state,async () => {
            calls++;
            return {
                status,responseText:JSON.stringify({
                    status:'fail',message:'access denied',
                }),
            };
        },
        ()=>false,()=>Object.assign(Error('feedback'),{code:'IG_FEEDBACK_REQUIRED'}),
        ()=>{},
        message=>Object.assign(Error(message),{code:'IG_API_UNHEALTHY'}),
        ()=>Object.assign(Error('rate'),{code:'IG_RATE_LIMITED'}),
        async()=>{sleeps++;},()=>0,
    );
    return {load,calls:()=>calls,sleeps:()=>sleeps};
}
for (const code of [400,401,403,404,410,422]) {
    const x=mediaInfoScenario(code);
    await assert.rejects(x.load('123456'),undefined,'HTTP '+code);
    assert.equal(x.calls(),1,'HTTP '+code+' must not retry or try another host');
    assert.equal(x.sleeps(),0,'HTTP '+code+' must not sleep then retry');
}

assert.ok(!source.includes('scanReelsAuthenticatedWithoutTab'));
assert.ok(!source.includes('https://www.instagram.com/api/v1/clips/user/'));
assert.ok(extract('scanReels').includes('REELS remains INCOMPLETE'));
assert.ok(extract('capturePartialDownloadGrants').includes(
    "state.scanOutcome !== 'INCOMPLETE'"
), 'only verified immutable partial sources may be downloaded');
assert.ok(extract('scanAll').includes(
    "state.scanOutcome = 'INCOMPLETE'"
), 'no unverified complete classification');
console.log('Architecture policy: REELS evidence, honest partial scope, authenticated circuit breaker and bounded 4xx retries — PASS.');
