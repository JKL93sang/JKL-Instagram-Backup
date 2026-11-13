import fs from 'node:fs';
import assert from 'node:assert/strict';

// Synthetic-only. No login, network, private account data or disk mutation.
const source=fs.readFileSync(new URL('../JKL_Instagram_Backup.user.js',import.meta.url),'utf8');
function extract(name) {
    const m=new RegExp('    (?:async )?function '+name+'\\(').exec(source);
    assert.ok(m,'missing production helper '+name);
    const end=source.indexOf('\n    }\n',m.index);
    assert.ok(end>m.index,'unterminated '+name);
    return source.slice(m.index,end+7);
}
const normalizePk=x=>String(x?.pk||x?.id||'').split('_')[0];
const datePart=timestamp=>new Date(timestamp*1000).toISOString().slice(0,10).replaceAll('-','_');
const filename=m=>'test - '+m.type+' - '+datePart(m.timestamp)+' - '+m.id+'.'+m.ext;
const canonicalShortcode=x=>String(x||'');
const makeRoot=(ids)=>({pk:'900',code:'CODE42',
    media_type:8,carousel_media:ids.map(pk=>({pk}))});
const makeRecord=(id)=>({
    id:String(id),type:'TAGGED',
    timestamp:0,shortcode:'CODE42',ext:'jpg',
    filename:'test - TAGGED - 2026_11_13 - '+id+'.jpg',
    sources:new Set(['TAGGED']),rootIds:new Set(['900']),
});
const verified=(id)=>({
    id:String(id),type:'POST',timestamp:1718048415,
    shortcode:'CODE42',filename:filename({...makeRecord(id),
        type:'POST',timestamp:1718048415}),
    sources:['PROFILE_GRID_NATIVE','TAGGED'],
});
function harness({old={},current=['901','902'],who='123'}={}) {
    const state={userId:who,queue:new Map(current.map(id=>[id,makeRecord(id)])),
        roots:{POST:new Set(),REEL:new Set(),TAGGED:new Set(['900'])}};
    const restore=new Function('state','loadDb','filename','canonicalShortcode',
        'normalizePk',extract('restoreHistoricalTaggedPostArchive')+
        '\nreturn restoreHistoricalTaggedPostArchive;'
    )(state,()=>({profiles:{[who]:{media:old}}}),
        filename,canonicalShortcode,normalizePk);
    return {state,restore};
}
{
    const h=harness({old:{901:verified('901'),902:verified('902')}});
    assert.equal(h.restore(makeRoot(['901','902'])),2);
    assert.equal(h.state.queue.get('901').type,'POST');
    assert.equal(h.state.queue.get('902').type,'POST');
    assert.equal(h.state.queue.get('901').timestamp,1718048415);
    assert.equal(h.state.queue.get('901').filename,verified('901').filename);
    assert.equal(h.state.queue.get('901').historicalPostArchiveContinuity,true);
    assert.equal(h.state.queue.get('901').sources.has('TAGGED'),true);
    assert.equal(h.state.roots.POST.size,0,
        'historical archive classification must NEVER fabricate live PROFILE discovery');
    assert.equal(h.restore(makeRoot(['901','902'])),0,
        'repeated TAGGED source cannot flip the same path again');
}
{
    const history=verified('901');
    for(const invalid of [
        {...history,type:'TAGGED'},
        {...history,sources:['TAGGED']},
        {...history,sources:['PROFILE_GRID_DOM']},
        {...history,timestamp:0},
        {...history,shortcode:'SOMEONE_ELSE'},
        {...history,filename:'test - POST - 2023_01_01 - 901.jpg'},
        {...history,filename:'../../escape.jpg'},
        {...history,filename:'test - POST - 2024_06_10 - 902.jpg'},
    ]) {
        const h=harness({old:{901:invalid}});
        assert.equal(h.restore(makeRoot(['901','902'])),0,
            'unverified history must never alter current TAGGED archive identity');
        assert.equal(h.state.queue.get('901').type,'TAGGED');
    }
}
{
    const h=harness({old:{901:verified('901')}});
    h.state.queue.get('901').shortcode='CONTRADICTING_ID';
    assert.equal(h.restore(makeRoot(['901','902'])),0);
    h.state.queue.get('901').shortcode='CODE42';
    h.state.queue.get('901').ext='mp4';
    assert.equal(h.restore(makeRoot(['901','902'])),0,
        'JPEG historical path may not silently be assigned to an MP4');
}
{
    const h=harness({old:{901:verified('901')}});
    h.state.queue.get('901').type='POST';
    assert.equal(h.restore(makeRoot(['901','902'])),0);
    assert.equal(h.state.roots.POST.size,0);
}
{
    const h=harness({old:{901:verified('901')}});
    h.state.queue.get('901').sources.delete('TAGGED');
    assert.equal(h.restore(makeRoot(['901','902'])),0);
}
assert.match(source,/TAGGED historical archive category preserved:/);
assert.match(source,/current PROFILE coverage unchanged/);
assert.match(source,/taggedHistoricalPostRestored:/);
assert.match(source,/taggedCountHintFailures:/);
assert.match(source,/<span>TAGGED rejected hints<\/span>/);
console.log('TAGGED previous native POST archive path stability, no false live OWNED membership — PASS');
