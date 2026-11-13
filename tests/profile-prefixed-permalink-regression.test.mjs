import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url),'utf8'
);
function extract(name) {
    const marker='    function '+name+'(';
    const pos=source.indexOf(marker);
    assert.ok(pos>=0,'production helper missing '+name);
    const end=source.indexOf('\n    }\n',pos);
    assert.ok(end>pos,'production helper unclosed '+name);
    return source.slice(pos,end+7);
}
const APP={PRIVATE_PERMALINK_SUFFIX_LENGTH:28};
const state={username:'petit._tigre'};
const location={origin:'https://www.instagram.com',
    href:'https://www.instagram.com/petit._tigre/reel/DSzg-mICLxk/'};
const docAnchors=[];
const document={
    querySelectorAll(sel){
        assert.ok(sel.includes('a[href*="/reel/"]'));
        return docAnchors;
    }
};
const cleanUser=x=>String(x||'').trim().replace(/^@/,'')
    .replace(/[^A-Za-z0-9._]/g,'');
const api=new Function('APP','location','state','document','cleanUser',
    [
        'canonicalShortcode','shortcodeId','mediaPermalinkInfo',
        'storyPermalinkInfo','storyViewerRouteInfo','singleDownloadTargetFromUrl',
        'profileLinks','currentSingleDownloadTarget',
    ].map(extract).join('\n')+
    '\nreturn {mediaPermalinkInfo,singleDownloadTargetFromUrl,profileLinks,currentSingleDownloadTarget};'
)(APP,location,state,document,cleanUser);

const expected='3797523949836352612';
const variants=[
    'https://www.instagram.com/reel/DSzg-mICLxk/',
    'https://www.instagram.com/petit._tigre/reel/DSzg-mICLxk/',
    '/petit._tigre/reel/DSzg-mICLxk/',
    '/petit._tigre/reel/DSzg-mICLxk/?utm_source=ig_web_copy_link',
];
for(const url of variants) {
    const m=api.mediaPermalinkInfo(url);
    assert.ok(m,'real media permalink should parse: '+url);
    assert.equal(m.route,'reel');
    assert.equal(m.shortcode,'DSzg-mICLxk');
    assert.equal(m.mediaId,expected);
    const target=api.singleDownloadTargetFromUrl(url);
    assert.equal(target.mediaId,expected);
    assert.equal(target.route,'reel');
}
assert.equal(api.mediaPermalinkInfo(variants[0]).username,'');
assert.equal(api.mediaPermalinkInfo(variants[1]).username,'petit._tigre');
assert.equal(api.singleDownloadTargetFromUrl(variants[1]).username,'petit._tigre');

const otherShortcode='DVwbyavEa1O';
for(const route of ['p','reel','tv']){
    assert.equal(
        api.singleDownloadTargetFromUrl(
            'https://www.instagram.com/petit._tigre/'+route+'/'+otherShortcode+'/'
        ).mediaId,'3850699893338385742'
    );
}
for(const bad of [
    '/petit._tigre/reels/',
    '/petit._tigre/tagged/',
    '/stories/petit._tigre/123456789',
    '/foo/bar/reel/DSzg-mICLxk/',
    '/petit._tigre/reel/DSzg-mICLxk/extra',
    '/petit._tigre/reel/!!!/',
    '/petit._tigre/reel/',
    '/petit._tigre/reel/DSzg-mICLxk/x',
]){
    assert.equal(api.mediaPermalinkInfo(bad),null,
        'invalid URLs must fail closed: '+bad);
}
function anchor(href){
    return {href:'https://www.instagram.com'+href,
        getAttribute:()=>href};
}
docAnchors.push(
    anchor('/petit._tigre/reel/DSzg-mICLxk/'),
    anchor('/other_account/reel/DVwbyavEa1O/'),
    anchor('/reel/DVwbyavEa1O/'),
    anchor('/petit._tigre/reels/'),
    anchor('/petit._tigre/reel/DSzg-mICLxk/'),
);
const observed=api.profileLinks();
assert.equal(observed.size,2);
assert.ok(observed.has(expected),'scoped prefixed Reel visible in DOM');
assert.ok(observed.has('3850699893338385742'),
    'legacy canonical media permalink remains accepted');
assert.equal(observed.get(expected).username,'petit._tigre');
state.username='another_profile';
assert.ok(!api.profileLinks().has(expected),
    'link explicitly scoped to another user must never become observed root');

// This is the current live Firefox location path; the previously rejected
// nested URL now generates a single download target without needing a DOM
// query or a request to Instagram.
const activeTarget=api.singleDownloadTargetFromUrl(location.href);
assert.equal(activeTarget.mediaId,expected);
assert.equal(activeTarget.kind,'media');
assert.equal(activeTarget.key,'media:'+expected);
console.log('Real /username/reel/, /username/p/, old canonical URLs, scoped PROFILE DOM and single-media target — PASS.');
