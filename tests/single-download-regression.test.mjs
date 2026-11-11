import fs from 'node:fs';
import assert from 'node:assert/strict';

const source =
    fs.readFileSync(
        new URL(
            '../JKL_Instagram_Backup.user.js',
            import.meta.url
        ),
        'utf8'
    );

function extractFunction(name) {
    const re =
        new RegExp(
            `^\\s*(?:async\\s+)?function\\s+${name}\\s*\\(`,
            'm'
        );

    const match =
        re.exec(source);

    assert.ok(
        match,
        `Missing function ${name}`
    );

    const start =
        match.index;

    const paramsStart =
        source.indexOf(
            '(',
            start
        );

    let parenDepth = 0;
    let bodyStart = -1;
    let quote = '';
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (
        let i = paramsStart;
        i < source.length;
        i++
    ) {
        const ch = source[i];
        const next = source[i + 1] || '';

        if (lineComment) {
            if (ch === '\n') lineComment = false;
            continue;
        }

        if (blockComment) {
            if (ch === '*' && next === '/') {
                blockComment = false;
                i++;
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (ch === '\\') {
                escaped = true;
                continue;
            }

            if (ch === quote) quote = '';
            continue;
        }

        if (ch === '/' && next === '/') {
            lineComment = true;
            i++;
            continue;
        }

        if (ch === '/' && next === '*') {
            blockComment = true;
            i++;
            continue;
        }

        if (
            ch === "'" ||
            ch === '"' ||
            ch === '`'
        ) {
            quote = ch;
            continue;
        }

        if (ch === '(') {
            parenDepth++;
            continue;
        }

        if (ch === ')') {
            parenDepth--;

            if (parenDepth === 0) {
                bodyStart =
                    source.indexOf(
                        '{',
                        i + 1
                    );
                break;
            }
        }
    }

    assert.notEqual(
        bodyStart,
        -1,
        `Missing body for ${name}`
    );

    let depth = 0;
    quote = '';
    escaped = false;
    lineComment = false;
    blockComment = false;

    for (
        let i = bodyStart;
        i < source.length;
        i++
    ) {
        const ch = source[i];
        const next = source[i + 1] || '';

        if (lineComment) {
            if (ch === '\n') lineComment = false;
            continue;
        }

        if (blockComment) {
            if (ch === '*' && next === '/') {
                blockComment = false;
                i++;
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (ch === '\\') {
                escaped = true;
                continue;
            }

            if (ch === quote) quote = '';
            continue;
        }

        if (ch === '/' && next === '/') {
            lineComment = true;
            i++;
            continue;
        }

        if (ch === '/' && next === '*') {
            blockComment = true;
            i++;
            continue;
        }

        if (
            ch === "'" ||
            ch === '"' ||
            ch === '`'
        ) {
            quote = ch;
            continue;
        }

        if (ch === '{') {
            depth++;
            continue;
        }

        if (ch === '}') {
            depth--;

            if (depth === 0) {
                return source.slice(
                    start,
                    i + 1
                );
            }
        }
    }

    throw new Error(
        `Unterminated function ${name}`
    );
}

const canonicalSource =
    extractFunction(
        'canonicalShortcode'
    );

const shortcodeIdSource =
    extractFunction(
        'shortcodeId'
    );

const mediaPermalinkSource =
    extractFunction(
        'mediaPermalinkInfo'
    );

const storyPermalinkSource =
    extractFunction(
        'storyPermalinkInfo'
    );

const targetUrlSource =
    extractFunction(
        'singleDownloadTargetFromUrl'
    );

const APP = {
    PRIVATE_PERMALINK_SUFFIX_LENGTH: 28,
};

const location = {
    origin:
        'https://www.instagram.com',
};

const cleanUser =
    value =>
        String(value || '')
            .trim()
            .replace(/^@/, '')
            .replace(
                /[^A-Za-z0-9._]/g,
                ''
            );

const helpers =
    new Function(
        'APP',
        'location',
        'cleanUser',
        `${canonicalSource}
${shortcodeIdSource}
${mediaPermalinkSource}
${storyPermalinkSource}
${targetUrlSource}
return {
    mediaPermalinkInfo,
    storyPermalinkInfo,
    singleDownloadTargetFromUrl,
};`
    )(
        APP,
        location,
        cleanUser
    );

const post =
    helpers.singleDownloadTargetFromUrl(
        'https://www.instagram.com/p/DVwbyavEa1O/'
    );

assert.ok(post);
assert.equal(
    post.kind,
    'media'
);
assert.equal(
    post.route,
    'p'
);
assert.equal(
    post.shortcode,
    'DVwbyavEa1O'
);
assert.equal(
    post.mediaId,
    '3850699893338385742'
);
assert.equal(
    post.key,
    'media:3850699893338385742'
);

const reel =
    helpers.singleDownloadTargetFromUrl(
        'https://www.instagram.com/reel/DVwbyavEa1O/'
    );

assert.ok(reel);
assert.equal(
    reel.kind,
    'media'
);
assert.equal(
    reel.route,
    'reel'
);
assert.equal(
    reel.mediaId,
    post.mediaId
);

const tv =
    helpers.singleDownloadTargetFromUrl(
        'https://www.instagram.com/tv/DVwbyavEa1O/'
    );

assert.ok(tv);
assert.equal(
    tv.route,
    'tv'
);

const story =
    helpers.singleDownloadTargetFromUrl(
        'https://www.instagram.com/stories/test.user/1234567890123456789/'
    );

assert.ok(story);
assert.equal(
    story.kind,
    'story'
);
assert.equal(
    story.route,
    'story'
);
assert.equal(
    story.username,
    'test.user'
);
assert.equal(
    story.mediaId,
    '1234567890123456789'
);
assert.equal(
    story.key,
    'story:1234567890123456789'
);

assert.equal(
    helpers.singleDownloadTargetFromUrl(
        'https://www.instagram.com/stories/highlights/1234567890123456789/'
    ),
    null,
    'highlight reel ID must not be treated as a story media ID'
);

assert.equal(
    helpers.singleDownloadTargetFromUrl(
        'https://www.instagram.com/stories/test.user/not-a-number/'
    ),
    null
);

const installSource =
    extractFunction(
        'installSingleDownloadEvents'
    );

for (
    const eventName
    of [
        'pointerdown',
        'mousedown',
        'touchstart',
        'click',
    ]
) {
    assert.ok(
        installSource.includes(
            `'${eventName}'`
        ),
        `missing ${eventName} interception`
    );
}

const pressSource =
    extractFunction(
        'handleSingleDownloadPress'
    );

assert.ok(
    pressSource.includes(
        'stopImmediatePropagation'
    ),
    'press lifecycle is not protected from parent React handlers'
);

const clickSource =
    extractFunction(
        'handleSingleDownloadClick'
    );

assert.ok(
    clickSource.includes(
        'singleDownloadTargetFromButton'
    )
);

assert.ok(
    clickSource.includes(
        'downloadSingleTarget'
    )
);

const downloadSource =
    extractFunction(
        'downloadSingleTarget'
    );

assert.ok(
    downloadSource.includes(
        "resolved.kind === 'story'"
    ),
    'story download does not force STORY type'
);

assert.ok(
    downloadSource.includes(
        'fetchStandaloneMediaInfo'
    ),
    'single download no longer resolves authoritative media info'
);

assert.ok(
    source.includes(
        'installSingleDownloadEvents();\n    init();'
    ),
    'single download event controller is not installed at document-start'
);

assert.ok(
    !source.includes(
        'function downloadSingleShortcode('
    ),
    'legacy shortcode-only single download path returned'
);

assert.ok(
    !source.includes(
        'function singleDownloadButtonInfo('
    ),
    'legacy button-info path returned'
);

const metadataVersion =
    source.match(
        /\/\/ @version\s+([0-9.]+)/
    )?.[1];

const appVersion =
    source.match(
        /VERSION:\s*'([0-9.]+)'/
    )?.[1];

assert.ok(metadataVersion);
assert.equal(
    metadataVersion,
    appVersion
);

console.log(
    'Single download controller regression tests passed.'
);


/* v1.5.101: viewport-pinned media-local overlay guards */
const chooseMediaCode=extractFunction('largestCurrentMedia');
const hostCode=extractFunction('currentMediaOverlayHost');
const placementCode=extractFunction('placeCurrentDownloadButton');
const currentTargetCode=extractFunction('currentSingleDownloadTarget');
const refreshCode=extractFunction('refreshCurrentDownloadButton');
assert.ok(currentTargetCode.includes('root?.matches?.'));
assert.ok(placementCode.includes('currentMediaOverlayHost'));
assert.ok(placementCode.includes('document.body.appendChild'),
    'floating control must escape React clipping and stacking');
assert.ok(refreshCode.includes('existing?.remove()'));
assert.ok(source.includes('#jkl-current-download.jkl-media-download-overlay'));
assert.ok(!source.includes('jkl-action-download'));
const mediaRect=(left,top,width,height)=>({
    left,top,width,height,right:left+width,bottom:top+height
});
const added=new Set();
const fakeDocument={
    body:{
        appendChild(button){button.parentElement=this;}
    },
    documentElement:{clientWidth:1920,clientHeight:1080}
};
const helpers=new Function(
    'window','document','location','getComputedStyle','ui',
    chooseMediaCode+'\n'+hostCode+'\n'+placementCode+
    '\nreturn {largestCurrentMedia,currentMediaOverlayHost,placeCurrentDownloadButton};'
)(
    {innerWidth:1920,innerHeight:1080},
    fakeDocument,{pathname:'/p/demo/'},
    ()=>({display:'block',visibility:'visible'}),
    {box:null}
);
const fakeMedia=rect=>({
    tagName:'IMG',
    getClientRects:()=>[rect],
    getBoundingClientRect:()=>rect,
    closest:()=>null
});
const primary=fakeMedia(mediaRect(550,110,680,760));
const small=fakeMedia(mediaRect(1710,100,200,200));
const offscreen=fakeMedia(mediaRect(2400,100,600,700));
const root={querySelectorAll:()=>[offscreen,small,primary]};
assert.equal(helpers.largestCurrentMedia(root),primary);
assert.equal(helpers.largestCurrentMedia({
    querySelectorAll:()=>[offscreen]
}),null);
assert.deepEqual(helpers.currentMediaOverlayHost(primary,root),
    {left:1182,top:122});
const button={
    parentElement:null,
    style:{},
    classList:{add:cls=>added.add(cls)},
    remove(){this.removed=true;}
};
assert.equal(helpers.placeCurrentDownloadButton(button,root),
    'viewport-pinned-media');
assert.equal(button.parentElement,fakeDocument.body);
assert.equal(button.style.left,'1182px');
assert.equal(button.style.top,'122px');
assert.ok(added.has('jkl-media-download-overlay'));
const offscreenRoot={querySelectorAll:()=>[offscreen]};
assert.equal(helpers.currentMediaOverlayHost(offscreen,offscreenRoot),null);
assert.equal(helpers.placeCurrentDownloadButton(button,offscreenRoot),
    'unavailable');
assert.equal(button.removed,true);
console.log('Viewport-pinned local overlay guards passed.');
