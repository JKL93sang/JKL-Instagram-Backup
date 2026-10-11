import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourcePath =
    new URL('../JKL_Instagram_Backup.user.js', import.meta.url);

const source =
    fs.readFileSync(
        sourcePath,
        'utf8'
    );

function extractFunction(name) {
    const marker =
        `function ${name}(`;

    const start =
        source.indexOf(marker);

    assert.notEqual(
        start,
        -1,
        `Missing function ${name}`
    );

    const braceStart =
        source.indexOf(
            '{',
            start
        );

    assert.notEqual(
        braceStart,
        -1,
        `Missing body for ${name}`
    );

    let depth = 0;
    let quote = '';
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (
        let i = braceStart;
        i < source.length;
        i++
    ) {
        const ch =
            source[i];

        const next =
            source[i + 1] || '';

        if (lineComment) {
            if (ch === '\n') {
                lineComment = false;
            }

            continue;
        }

        if (blockComment) {
            if (
                ch === '*' &&
                next === '/'
            ) {
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

            if (ch === quote) {
                quote = '';
            }

            continue;
        }

        if (
            ch === '/' &&
            next === '/'
        ) {
            lineComment = true;
            i++;
            continue;
        }

        if (
            ch === '/' &&
            next === '*'
        ) {
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

const permalinkSource =
    extractFunction(
        'mediaPermalinkInfo'
    );

const APP = {
    PRIVATE_PERMALINK_SUFFIX_LENGTH: 28,
};

const location = {
    origin:
        'https://www.instagram.com',
};

const helpers =
    new Function(
        'APP',
        'location',
        `${canonicalSource}
${shortcodeIdSource}
${permalinkSource}
return {
    canonicalShortcode,
    shortcodeId,
    mediaPermalinkInfo,
};`
    )(
        APP,
        location
    );

const publicCode =
    'DVwbyavEa1O';

const publicId =
    '3850699893338385742';

assert.equal(
    helpers.canonicalShortcode(
        publicCode
    ),
    publicCode,
    'ordinary public shortcode changed'
);

assert.equal(
    helpers.shortcodeId(
        publicCode
    ),
    publicId,
    'public shortcode decode changed'
);

for (
    const canonical
    of [
        'AbCdEfGhIj',
        publicCode,
    ]
) {
    const extended =
        canonical +
        'A'.repeat(28);

    assert.equal(
        helpers.canonicalShortcode(
            extended
        ),
        canonical,
        `extended permalink failed for canonical length ${canonical.length}`
    );

    assert.equal(
        helpers.shortcodeId(
            extended
        ),
        helpers.shortcodeId(
            canonical
        ),
        'extended permalink changed numeric media identity'
    );

    const info =
        helpers.mediaPermalinkInfo(
            `https://www.instagram.com/p/${extended}/`
        );

    assert.ok(
        info,
        'extended permalink was rejected'
    );

    assert.equal(
        info.shortcode,
        canonical
    );

    assert.equal(
        info.mediaId,
        helpers.shortcodeId(
            canonical
        )
    );

    assert.equal(
        info.rawToken,
        extended
    );

    assert.equal(
        info.extended,
        true
    );
}

const normalInfo =
    helpers.mediaPermalinkInfo(
        `/reel/${publicCode}/`
    );

assert.ok(normalInfo);
assert.equal(
    normalInfo.route,
    'reel'
);
assert.equal(
    normalInfo.shortcode,
    publicCode
);
assert.equal(
    normalInfo.mediaId,
    publicId
);
assert.equal(
    normalInfo.extended,
    false
);

assert.equal(
    helpers.shortcodeId(
        '___________'
    ),
    '',
    'out-of-range 64-bit media ID was accepted'
);

assert.equal(
    helpers.mediaPermalinkInfo(
        '/explore/'
    ),
    null
);

assert.equal(
    helpers.canonicalShortcode(
        'bad token!'
    ),
    ''
);

assert.ok(
    !source.includes(
        'token.length === 39'
    ),
    'obsolete fixed-length private permalink rule returned'
);

assert.ok(
    !source.includes(
        'function hydrateShortcodes('
    ),
    'obsolete shortcode-only DOM hydration path returned'
);

const metadataVersion =
    source.match(
        /\/\/ @version\s+([0-9.]+)/
    )?.[1];

const appVersion =
    source.match(
        /VERSION:\s*'([0-9.]+)'/
    )?.[1];

assert.ok(
    metadataVersion,
    'metadata version missing'
);

assert.equal(
    metadataVersion,
    appVersion,
    '@version and APP.VERSION differ'
);

const functionNames =
    [
        ...source.matchAll(
            /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm
        ),
    ]
        .map(match => match[1]);

assert.equal(
    new Set(functionNames).size,
    functionNames.length,
    'duplicate named function detected'
);

console.log(
    `Instagram identity/static regression tests passed: ${functionNames.length} unique functions, version ${metadataVersion}.`
);
