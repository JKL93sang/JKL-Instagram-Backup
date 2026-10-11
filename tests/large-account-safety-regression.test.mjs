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
    const marker =
        `function ${name}(`;

    const start =
        source.indexOf(marker);

    assert.notEqual(
        start,
        -1,
        `Missing function ${name}`
    );

    const paramsStart =
        source.indexOf(
            '(',
            start
        );

    let parenDepth = 0;
    let braceStart = -1;
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
                braceStart =
                    source.indexOf(
                        '{',
                        i + 1
                    );
                break;
            }
        }
    }

    assert.notEqual(
        braceStart,
        -1,
        `Missing body for ${name}`
    );

    let depth = 0;
    quote = '';
    escaped = false;
    lineComment = false;
    blockComment = false;

    for (
        let i = braceStart;
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

function numericConstant(name) {
    const match =
        source.match(
            new RegExp(
                `\\b${name}:\\s*(\\d+)`
            )
        );

    assert.ok(
        match,
        `Missing numeric APP constant ${name}`
    );

    return Number(match[1]);
}

const policySource =
    extractFunction(
        'profileCompletionRequirement'
    );

const policy =
    new Function(
        `${policySource}
return profileCompletionRequirement;`
    )();

/*
 * Large, clean native PROFILE completion must stay fast.
 * The exact root count is deliberately much larger than ordinary profiles.
 */
const largeTrusted =
    policy({
        primeCaptured: true,
        nativeEnded: true,
        nativeOwned: 2000,
        expected: 2000,
    });

assert.equal(
    largeTrusted.required,
    false,
    'large trusted native PROFILE would be replayed canonically'
);

/*
 * Large account + missed prime must still fail safe and request canonical
 * verification rather than trusting a late page_info_end.
 */
const largeMissedPrime =
    policy({
        primeCaptured: false,
        nativeEnded: true,
        nativeOwned: 2000,
        expected: 2000,
    });

assert.equal(
    largeMissedPrime.required,
    true
);

assert.ok(
    largeMissedPrime.reasons.includes(
        'prime_capture_missed'
    )
);

/*
 * Large account + contradictory counter gets one canonical verification.
 * The counter is only the trigger, never the proof.
 */
const largeCounterConflict =
    policy({
        primeCaptured: true,
        nativeEnded: true,
        nativeOwned: 1990,
        expected: 2000,
    });

assert.equal(
    largeCounterConflict.required,
    true
);

assert.deepEqual(
    largeCounterConflict.reasons,
    [
        'native_below_ig_counter',
    ]
);

const profileMax =
    numericConstant(
        'PROFILE_MAX_SCROLLS'
    );

const reelMax =
    numericConstant(
        'REEL_MAX_SCROLLS'
    );

const taggedMax =
    numericConstant(
        'TAGGED_MAX_PAGES'
    );

const bulkThreshold =
    numericConstant(
        'HYDRATE_BULK_THRESHOLD'
    );

const bulkSize =
    numericConstant(
        'HYDRATE_BULK_SIZE'
    );

const largeThreshold =
    numericConstant(
        'HYDRATE_LARGE_THRESHOLD'
    );

const largeWorkers =
    numericConstant(
        'HYDRATE_LARGE_WORKERS'
    );

const singleCap =
    numericConstant(
        'HYDRATE_SINGLE_FALLBACK_CAP'
    );

assert.ok(
    profileMax >= 200,
    'PROFILE pagination safety cap regressed'
);

assert.ok(
    profileMax * 12 >= 2400,
    'PROFILE fallback no longer covers the historical large-profile envelope'
);

assert.ok(
    reelMax >= 5000,
    'REELS large-account cap regressed'
);

assert.ok(
    taggedMax >= 5000,
    'TAGGED large-account cap regressed'
);

assert.equal(
    bulkThreshold,
    100,
    'bulk hydration threshold changed unexpectedly'
);

assert.equal(
    bulkSize,
    20,
    'bulk hydration batch size changed unexpectedly'
);

assert.equal(
    largeThreshold,
    250,
    'large hydration threshold changed unexpectedly'
);

assert.equal(
    largeWorkers,
    2,
    'large hydration worker cap changed unexpectedly'
);

assert.equal(
    singleCap,
    100,
    'safe single fallback cap changed unexpectedly'
);

const fallbackSource =
    extractFunction(
        'scanProfileGraphQLFallback'
    );

assert.ok(
    fallbackSource.includes(
        'page <= APP.PROFILE_MAX_SCROLLS'
    ),
    'PROFILE fallback no longer respects safety cap'
);

assert.ok(
    fallbackSource.includes(
        'count: 12'
    ),
    'PROFILE fallback page size changed unexpectedly'
);

assert.ok(
    fallbackSource.includes(
        'has_next_page === false'
    ),
    'PROFILE fallback lost explicit page_info end proof'
);

assert.ok(
    fallbackSource.includes(
        'seenCursors.has(next)'
    ),
    'PROFILE fallback lost repeated-cursor protection'
);

assert.ok(
    fallbackSource.includes(
        "throwIfInstagramStop(e, 'PROFILE GraphQL completion')"
    ),
    'PROFILE fallback lost feedback/rate-limit fail-fast'
);

assert.ok(
    fallbackSource.includes(
        'await sleep(rand(APP.PAGE_MIN, APP.PAGE_MAX))'
    ),
    'PROFILE fallback lost request pacing'
);

const hydrationSource =
    extractFunction(
        'hydrateOwnedRootsDeep'
    );

assert.ok(
    hydrationSource.includes(
        'APP.HYDRATE_BULK_THRESHOLD'
    ),
    'bulk hydration path disappeared'
);

assert.ok(
    hydrationSource.includes(
        'APP.HYDRATE_LARGE_WORKERS'
    ),
    'large-account worker reduction disappeared'
);

assert.ok(
    hydrationSource.includes(
        'APP.HYDRATE_SINGLE_FALLBACK_CAP'
    ),
    'safe single-request cap disappeared'
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
    `Large-account safety regression tests passed. PROFILE cap=${profileMax} pages (~${profileMax * 12} edges), REELS cap=${reelMax}, TAGGED cap=${taggedMax}.`
);
