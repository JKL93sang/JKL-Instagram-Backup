import fs from 'node:fs';
import assert from 'node:assert/strict';

// Synthetic, no live session, no network and no personal Instagram data.
const source = fs.readFileSync(new URL(
    '../JKL_Instagram_Backup.user.js', import.meta.url
), 'utf8');

function extract(name) {
    const m = new RegExp('    (?:async )?function '+name+'\\(').exec(source);
    assert.ok(m, 'missing production '+name);
    const end = source.indexOf('\n    }\n', m.index);
    assert.ok(end > m.index, 'unterminated production '+name);
    return source.slice(m.index, end+7);
}
const normalizePk = x => String(x?.pk || x?.id || '').split('_')[0];
const child = (id,kind=1,url=true) => ({
    pk:String(id),media_type:kind,
    ...(url ? {url:'https://cdn.example.test/'+id+'.'+(kind===2?'mp4':'jpg')} : {}),
});
const sidecar = (children, count=4,extra={}) => ({
    pk:'500',code:'CxExample',media_type:8,
    carousel_media_count:count,
    user:{pk:'70'},carousel_media:children,...extra,
});
const kids = [child('501'),child('502'),child('503')];
const listing = sidecar(kids,4);
const detailed = sidecar(kids.map(x=>({...x})),4);
const reconcile = new Function('normalizePk',
    extract('taggedAccessibleCarouselProof')+
    '\nreturn taggedAccessibleCarouselProof;'
)(normalizePk);
const proof = state => new Function('state','normalizePk',
    extract('discoveredMediaResolution')+
    '\nreturn discoveredMediaResolution;'
)(state,normalizePk);
function archive(raw,sourceName,state) {
    const item = raw?.media && typeof raw.media === 'object' ? raw.media : raw;
    const units = Array.isArray(item.carousel_media) && item.carousel_media.length
        ? item.carousel_media : [item];
    for(const c of units) {
        if(!c.url) continue;
        const id=normalizePk(c);
        const old=state.queue.get(id);
        if (old) {
            old.sources.add(sourceName);
            old.rootIds.add(normalizePk(item));
        } else {
            state.queue.set(id,{id,url:c.url,filename:id+'.jpg',
                sources:new Set([sourceName]),
                rootIds:new Set([normalizePk(item)])});
        }
    }
}
{
    assert.deepEqual(reconcile(listing,detailed), {
        ok:true,reason:'verified_accessible_count_hint_mismatch',
        rootId:'500',declared:4,accessible:3,sameOrder:true,
    });
    const state={queue:new Map()};
    archive(detailed,'TAGGED',state);
    assert.equal(proof(state)(detailed,'TAGGED').ok,false,
        'ordinary proof must still reject 4 declared vs 3 children');
    assert.equal(proof(state)(detailed,'TAGGED',
        {verifiedAccessibleCarousel:true}).ok,true,
        'only a separately verified carousel may ignore the count hint');
    assert.equal(proof(state)(detailed,'POST',
        {verifiedAccessibleCarousel:true}).ok,false,
        'override must not affect PROFILE, HIGHLIGHTS or other sources');
}
assert.deepEqual(reconcile(listing,
    sidecar([kids[0],kids[2],kids[1]],4)),{
        ok:true,reason:'verified_accessible_count_hint_mismatch',
        rootId:'500',declared:4,accessible:3,sameOrder:false,
    },'same authentic child set in different order must be allowed');

const wrong = [
    [sidecar(kids,3),detailed,'no greater count hint'],
    [sidecar(kids,5),sidecar(kids,4),'conflicting detailed count'],
    [listing,sidecar(kids,4,{pk:'999'}),'different root'],
    [listing,sidecar(kids,4,{user:{pk:'71'}}),'different owner'],
    [listing,sidecar(kids,4,{code:'OtherCode'}),'different shortcode'],
    [listing,sidecar([kids[0],kids[1],kids[1]],4),'duplicate child'],
    [listing,sidecar([...kids,child('504')],4),'more detailed children'],
    [listing,sidecar(kids.slice(0,2),4),'fewer detailed children'],
    [listing,sidecar(kids,4,{carousel_media_ids:['501','502','503','504']}),
        'independent fourth child'],
    [sidecar(kids,4,{carousel_media_ids:['501','502','503','504']}),detailed,
        'independent listing fourth child'],
    [listing,sidecar(kids,4,{edge_sidecar_to_children:{
        edges:kids.concat(child('504')).map(node=>({node})),
        page_info:{has_next_page:false}}}),'extra sidecar edge'],
    [listing,sidecar(kids,4,{edge_sidecar_to_children:{
        page_info:{has_next_page:true}}}),'unfinished child page'],
    [listing,sidecar(kids,4,{carousel_media_pending_post_count:1}),
        'pending child'],
    [listing,sidecar([kids[0],child('502',2),kids[2]],4),'child video disagreement'],
    [listing,sidecar([kids[0],{...kids[1],carousel_parent_id:'777'},kids[2]],4),
        'child parent mismatch'],
    [listing,sidecar([kids[0],{...kids[1],deleted_reason:2},kids[2]],4),
        'deleted child present in response'],
    [listing,sidecar(kids,4,{media_type:1}),'no matching carousel type'],
    [listing,sidecar(kids,4,{carousel_media_count:6}),'other declared hint'],
];
for(const [left,right,why] of wrong) {
    assert.equal(reconcile(left,right).ok,false,why);
}
async function runTagged(left,right) {
    const state={userId:'1',cancelled:false,queue:new Map(),
        roots:{TAGGED:new Set()},coverage:{tagged:false}};
    const net={taggedDocInitial:null,taggedDocConnection:null,
        taggedNativeVariables:null,taggedInitialData:null,
        taggedInitialUserId:''};
    const logs=[],requests=[];
    const scanner=new Function('state','net','APP','gql','taggedConn',
        'edgeNode','addMedia','discoveredMediaResolution','normalizePk',
        'taggedAccessibleCarouselProof','restoreHistoricalTaggedPostArchive',
        'fetchOwnedMediaInfo','updateStats',
        'log','throwIfInstagramStop','sleep','rand',
        extract('scanTaggedGraphQL')+'\nreturn scanTaggedGraphQL;'
    )(state,net,{TAGGED_FALLBACK_DOC:'fixture',TAGGED_MAX_PAGES:2,
        TAGGED_HYDRATION_LIMIT:1,PAGE_MIN:1,PAGE_MAX:1},
        async()=>({conn:{edges:[{node:left}],
            page_info:{has_next_page:false,end_cursor:null}}}),
        d=>d.conn,e=>e.node,
        (m,_type,origin)=>archive(m,origin,state),proof(state),normalizePk,
        reconcile,()=>0,async(id,_label,policy)=>{
            requests.push({id,policy});
            return right;
        },()=>{},(line)=>logs.push(String(line)),()=>{},async()=>{},()=>0);
    const ok=await scanner();
    return {ok,state,logs,requests};
}
{
    const r=await runTagged(listing,detailed);
    assert.equal(r.ok,true,'3 accessible authenticated children are complete');
    assert.equal(r.state.queue.size,3,'exactly three real child IDs, not four');
    assert.equal(r.state.roots.TAGGED.size,1);
    assert.equal(r.requests.length,1,'only one same-origin media-info request');
    assert.equal(r.requests[0].policy.singleWebOnly,true);
    assert.ok(r.logs.some(s=>s.includes(
        'TAGGED accessible carousel count hint mismatch: root=500, declared=4')));
    assert.ok(r.logs.some(s=>s.includes('count_hint_mismatches=1')));
    assert.ok(r.logs.some(s=>s.includes('resolved=1, unresolved=0')));
    assert.deepEqual(r.state.taggedCountHintMismatches,[{
        rootId:'500',shortcode:'CxExample',declared:4,accessible:3,
        sameAuthenticatedChildren:true,sameOrder:true,
        historicalCompletenessUnknown:true,
    }],'manifest must retain a compact, explainable anomaly record');
}
{
    const r=await runTagged(listing,sidecar(kids,4,{
        carousel_media_ids:['501','502','503','504']}));
    assert.equal(r.ok,false,'explicit fourth child inventory must block completion');
    assert.ok(r.logs.some(s=>s.includes('unresolved=1')));
    assert.ok(r.logs.some(s=>s.includes(
        'TAGGED count hint proof rejected: root=500, reason=independent_child_ids_conflict')),
        'scanner must provide actionable, privacy-safe rejection diagnostics');
    assert.equal(r.state.taggedCountHintFailures.length,1);
    assert.equal(r.state.taggedCountHintFailures[0].reason,
        'independent_child_ids_conflict');
    assert.deepEqual(r.state.taggedCountHintMismatches,[],
        'rejected count hints are not classified as verified accessible');
}
{
    // Missing from BOTH authenticated sources. A URL present in the
    // listing would itself be valid media evidence, so do not discard it.
    const unavailable = [child('501'),child('502'),child('503',1,false)];
    const r=await runTagged(sidecar(unavailable,4),sidecar(unavailable,4));
    assert.equal(r.ok,false,'missing authenticated child URL cannot count as downloaded');
}
{
    const r=await runTagged(listing,sidecar([...kids,child('504')],4));
    assert.equal(r.ok,true,'a genuinely returned fourth child is archived');
    assert.equal(r.state.queue.size,4,'no fourth media created in other paths');
    assert.ok(!r.logs.some(s=>s.includes('count hint mismatch: root=')));
}
{
    const r=await runTagged(listing,sidecar([
        child('501'),child('502'),child('503'),
    ],3,{user:{pk:'999'}}));
    assert.equal(r.ok,false,'different media owner may not use count override');
}
assert.ok(source.includes('taggedCountHintMismatches:'), 'manifest includes count warnings');
assert.ok(source.includes('taggedCountHintFailures:'), 'manifest includes rejected proof reasons');
assert.ok(source.includes('taggedHistoricalPostRestored:'), 'manifest includes archive continuity count');
assert.ok(source.includes('<span>TAGGED count hints</span>'),
    'user sees count mismatch even when TAGGED accessible coverage passes');
console.log('TAGGED authenticated accessible count hint reconciliation: PASS');
