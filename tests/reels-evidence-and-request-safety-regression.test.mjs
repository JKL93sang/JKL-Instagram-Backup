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
    ['SSR metadata conflict', {metadataConflict:true}],
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
        x=>String(x).replace(new RegExp('/+$'), ''),
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
        extract('unsafePrivateRestMethod') +
        extract('instagramRequestScope') +
        extract('gmRequest') +
        '\nreturn gmRequest;');
    const request=create(state,gm);
    return {request,state,calls:()=>networkCalls};
}
for (const [type, reply, flag] of [
    ['feedback',{status:200,body:'{"message":"feedback_required"}'},'feedbackRequired'],
    ['rate limit',{status:429,body:'{"status":"fail"}'},'rateLimited'],
    ['checkpoint',{status:200,body:'{"message":"challenge_required"}'},'apiUnhealthy'],
    ['login expired HTTP 401',{status:401,body:'{"status":"fail"}'},'apiUnhealthy'],
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

// Deterministically test the real global GM dispatcher with five callers
// and deliberately delayed network callbacks. 5 starts => only two requests
// on the wire. A feedback_required reply must discard queued (not sent) jobs.
{
    const state={
        running:true,cancelled:false,scanComplete:false,scanOutcome:'RUNNING',
        feedbackRequired:false,feedbackMessage:'',rateLimited:false,
        rateLimitMessage:'',apiUnhealthy:false,apiUnhealthyMessage:'',
    };
    const sent=[];
    const gm=(opts)=>{sent.push(opts);};
    const build=new Function('state','GM_xmlhttpRequest',
        extract('feedbackRequiredIn') +
        extract('instagramAuthChallengeIn') +
        extract('feedbackCircuitBreak') +
        extract('rateLimitCircuitBreak') +
        extract('apiUnhealthyError') +
        extract('unsafePrivateRestMethod') +
        extract('instagramRequestScope') +
        extract('gmRequest') +
        '\nreturn gmRequest;'
    );
    const request=build(state,gm);
    const promises=Array.from({length:5},(_,i)=>
        request({
            method:'GET',
            url:'https://www.instagram.com/api/v1/users/'+i+'/info/',
        })
    );
    const results=Promise.allSettled(promises);
    assert.equal(sent.length,2,'at most two simultaneous GM requests');
    sent[0].onload({
        status:200,
        responseText:'{"status":"ok"}',
        responseHeaders:'content-type: application/json',
    });
    assert.equal(sent.length,3,'one slot released permits exactly one queued request');
    sent[1].onload({
        status:200,
        responseText:'{"message":"feedback_required"}',
        responseHeaders:'content-type: application/json',
    });
    assert.equal(state.feedbackRequired,true);
    assert.equal(sent.length,3,'no fourth or fifth dispatch after first feedback');
    sent[2].onload({
        status:200,
        responseText:'{"status":"ok"}',
        responseHeaders:'content-type: application/json',
    });
    const settled=await results;
    assert.deepEqual(settled.map(x=>x.status),
        ['fulfilled','rejected','fulfilled','rejected','rejected'],
        'already-sent responses may finish, but pending requests are rejected');
    assert.equal(sent.length,3);
    await assert.rejects(request({
        method:'GET',url:'https://www.instagram.com/api/v1/users/7/info/',
    }));
    assert.equal(sent.length,3,'subsequent attempts cannot restart dispatch');
}
{
    const state={
        running:true,cancelled:false,scanComplete:false,scanOutcome:'RUNNING',
        feedbackRequired:false,feedbackMessage:'',rateLimited:false,
        rateLimitMessage:'',apiUnhealthy:false,apiUnhealthyMessage:'',
    };
    const sent=[];
    const build=new Function('state','GM_xmlhttpRequest',
        extract('feedbackRequiredIn') +
        extract('instagramAuthChallengeIn') +
        extract('feedbackCircuitBreak') +
        extract('rateLimitCircuitBreak') +
        extract('apiUnhealthyError') +
        extract('unsafePrivateRestMethod') +
        extract('instagramRequestScope') +
        extract('gmRequest') +
        '\nreturn gmRequest;'
    );
    const request=build(state,opts=>sent.push(opts));
    const first=request({method:'GET',
        url:'https://www.instagram.com/api/v1/users/1/info/'});
    const pending=request({method:'GET',
        url:'https://www.instagram.com/api/v1/users/2/info/'});
    const third=request({method:'GET',
        url:'https://www.instagram.com/api/v1/users/3/info/'});
    const settled=Promise.allSettled([first,pending,third]);
    assert.equal(sent.length,2);
    sent[0].onerror({status:429,error:'network denied'});
    assert.equal(state.rateLimited,true,
        '429 from onerror, not just onload, must open circuit');
    assert.equal(sent.length,2,
        'pending request must never be dispatched after onerror 429');
    sent[1].onerror({status:0,error:'disconnected'});
    const done=await settled;
    assert.equal(done[0].status,'rejected');
    assert.equal(done[2].status,'rejected');
}

// onerror can carry an HTTP denial, not only a low-level socket error.
// No follow-up GM call is permitted after a denial on this callback path.
for (const [kind, event, expected] of [
    ['feedback',{status:403,responseText:'{"message":"feedback_required"}'},
        'feedbackRequired'],
    ['expired auth',{status:401,responseText:'{"status":"fail"}'},
        'apiUnhealthy'],
    ['checkpoint',{status:403,responseText:'{"message":"challenge_required"}'},
        'apiUnhealthy'],
]) {
    const state={
        running:true,cancelled:false,scanComplete:false,scanOutcome:'RUNNING',
        feedbackRequired:false,feedbackMessage:'',rateLimited:false,
        rateLimitMessage:'',apiUnhealthy:false,apiUnhealthyMessage:'',
    };
    const sent=[];
    const build=new Function('state','GM_xmlhttpRequest',
        extract('feedbackRequiredIn')+
        extract('instagramAuthChallengeIn')+
        extract('feedbackCircuitBreak')+
        extract('rateLimitCircuitBreak')+
        extract('apiUnhealthyError')+
        extract('unsafePrivateRestMethod') +
        extract('instagramRequestScope') +
        extract('gmRequest') +
        '\nreturn gmRequest;'
    );
    const request=build(state,opts=>sent.push(opts));
    const first=request({
        method:'GET',url:'https://www.instagram.com/api/v1/users/1/info/',
    });
    assert.equal(sent.length,1);
    sent[0].onerror(event);
    await assert.rejects(first,undefined,kind);
    assert.equal(state[expected],true,kind+' must open circuit');
    await assert.rejects(request({
        method:'GET',url:'https://www.instagram.com/api/v1/users/2/info/',
    }));
    assert.equal(sent.length,1,kind+' must prevent subsequent transport');
}

// An Instagram caption saying "feedback_required" is not a server error.
// Use the actual parser and enforce the GET-only private REST rule at
// the central GM transport boundary, while preserving approved Web GraphQL.
{
    const detect=new Function(
        extract('feedbackRequiredIn')+'\nreturn feedbackRequiredIn;'
    )();
    assert.equal(detect('feedback_required'),true);
    assert.equal(detect('Instagram returned feedback_required.'),true);
    assert.equal(detect('{"status":"fail","message":"feedback_required"}'),true);
    assert.equal(detect({errors:[{message:'feedback_required'}]}),true);
    assert.equal(detect({
        status:'ok',items:[{caption:{text:'feedback_required'}}],
    }),false,'media captions must not be promoted to Instagram control fields');
    assert.equal(detect('<html>Somebody posted feedback_required</html>'),false);
}
{
    const state={
        running:true,cancelled:false,scanComplete:false,scanOutcome:'RUNNING',
        feedbackRequired:false,feedbackMessage:'',rateLimited:false,
        rateLimitMessage:'',apiUnhealthy:false,apiUnhealthyMessage:'',
    };
    let sent=0;
    const dispatcher=new Function('state','GM_xmlhttpRequest',
        extract('feedbackRequiredIn')+
        extract('instagramAuthChallengeIn')+
        extract('feedbackCircuitBreak')+
        extract('rateLimitCircuitBreak')+
        extract('apiUnhealthyError')+
        extract('unsafePrivateRestMethod') +
        extract('instagramRequestScope') +
        extract('gmRequest') +
        '\nreturn gmRequest;'
    )(state,opts=>{
        sent++;
        opts.onload({status:200,responseText:'{"status":"ok"}',
            responseHeaders:'content-type: application/json'});
    });
    for(const host of ['www.instagram.com','i.instagram.com']) {
        await assert.rejects(dispatcher({
            method:'POST',
            url:'https://'+host+'/api/v1/clips/user/',
        }),e=>e.code==='IG_UNSUPPORTED_TRANSPORT');
        assert.equal(sent,0,'private REST POST must be rejected locally');
    }
    await dispatcher({
        method:'POST',url:'https://www.instagram.com/api/graphql',
    });
    assert.equal(sent,1,'existing Web GraphQL POST must remain functional');
    await dispatcher({
        method:'GET',url:'https://www.instagram.com/api/v1/users/1/info/',
    });
    assert.equal(sent,2,'known profile REST GET must remain functional');
}

// Responses from CDN media hosts can be JSON / 401 / 429 without
// implying any authenticated Instagram API session restriction.
for (const responseKind of ['load', 'error']) {
    for (const [status, body] of [
        [401, '{"message":"challenge_required"}'],
        [429, '{"message":"feedback_required"}'],
    ]) {
        const state={
            running:true,cancelled:false,scanComplete:false,scanOutcome:'RUNNING',
            feedbackRequired:false,feedbackMessage:'',rateLimited:false,
            rateLimitMessage:'',apiUnhealthy:false,apiUnhealthyMessage:'',
        };
        const sent=[];
        const request=new Function('state','GM_xmlhttpRequest',
            extract('feedbackRequiredIn')+
            extract('instagramAuthChallengeIn')+
            extract('feedbackCircuitBreak')+
            extract('rateLimitCircuitBreak')+
            extract('apiUnhealthyError')+
            extract('unsafePrivateRestMethod')+
            extract('instagramRequestScope')+
            extract('gmRequest')+
            '\nreturn gmRequest;'
        )(state,options=>sent.push(options));
        const promise=request({
            method:'GET',
            url:'https://scontent.cdninstagram.com/example.jpg',
            responseType:'arraybuffer',
        });
        assert.equal(sent.length,1);
        const event={status,responseText:body,
            responseHeaders:'content-type: application/json'};
        if(responseKind==='load') {
            sent[0].onload(event);
            assert.equal((await promise).status,status);
        } else {
            sent[0].onerror(event);
            await assert.rejects(promise,e=>e.status===status);
        }
        assert.equal(state.feedbackRequired,false,
            'CDN response must not trigger an Instagram feedback circuit');
        assert.equal(state.rateLimited,false,
            'CDN status must not trigger Instagram API rate circuit');
        assert.equal(state.apiUnhealthy,false,
            'CDN 401 must not invalidate Instagram authentication');
    }
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
assert.ok(extract('scanReels').includes('REELS surface skipped if other selected sources verify'));
assert.ok(extract('capturePartialDownloadGrants').includes(
    "state.scanOutcome !== 'INCOMPLETE'"
), 'only verified immutable partial sources may be downloaded');
assert.ok(extract('scanAll').includes(
    "state.scanOutcome = 'INCOMPLETE'"
), 'no unverified complete classification');
console.log('Architecture policy: REELS evidence, honest partial scope, authenticated circuit breaker and bounded 4xx retries — PASS.');
