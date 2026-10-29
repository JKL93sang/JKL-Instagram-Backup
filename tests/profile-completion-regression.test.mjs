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

    assert.notEqual(
        paramsStart,
        -1,
        `Missing parameter list for ${name}`
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

            if (ch === quote) {
                quote = '';
            }
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
        `Missing function body for ${name}`
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

            if (ch === quote) {
                quote = '';
            }
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
 * Regression case: missed prime capture with a partial 9/21 native result:
 * prime missed, native later exposes 9/21 and a false end flag.
 * The late false end must NEVER suppress canonical completion.
 */
const missedPrimeCase =
    policy({
        primeCaptured: false,
        nativeEnded: true,
        nativeOwned: 9,
        expected: 21,
    });

assert.equal(
    missedPrimeCase.required,
    true
);

assert.ok(
    missedPrimeCase.reasons.includes(
        'prime_capture_missed'
    )
);

assert.ok(
    missedPrimeCase.reasons.includes(
        'native_below_ig_counter'
    )
);

/*
 * A timely native PROFILE capture is already scoped to a known query family
 * and the current profile. Private status alone must NOT replay the whole
 * canonical pagination, especially on large accounts.
 */
const privateFullNative =
    policy({
        primeCaptured: true,
        nativeEnded: true,
        nativeOwned: 21,
        expected: 21,
    });

assert.equal(
    privateFullNative.required,
    false
);

assert.deepEqual(
    privateFullNative.reasons,
    []
);

/*
 * Public, fresh, internally coherent native completion can remain fast.
 * Its independent PUBLIC Shadow phase is still checked later.
 */
const publicTrusted =
    policy({
        primeCaptured: true,
        nativeEnded: true,
        nativeOwned: 21,
        expected: 21,
    });

assert.equal(
    publicTrusted.required,
    false
);

/*
 * media_count is only a trigger for independent verification.
 * It is not itself a completion requirement after canonical GraphQL ends.
 */
const publicCounterConflict =
    policy({
        primeCaptured: true,
        nativeEnded: true,
        nativeOwned: 15,
        expected: 21,
    });

assert.equal(
    publicCounterConflict.required,
    true
);

assert.deepEqual(
    publicCounterConflict.reasons,
    [
        'native_below_ig_counter',
    ]
);

/*
 * Missing native end always requires canonical completion.
 */
const missingEnd =
    policy({
        primeCaptured: true,
        nativeEnded: false,
        nativeOwned: 21,
        expected: 21,
    });

assert.equal(
    missingEnd.required,
    true
);

assert.ok(
    missingEnd.reasons.includes(
        'native_end_unproven'
    )
);

/*
 * Static anti-regression: when fallback is requested, only fallback.ended
 * may prove PROFILE completion. The old stale-page-info OR must never return.
 */
assert.ok(
    source.includes(
        'navigationEnded =\n                    fallback.ended ===\n                    true;'
    ),
    'canonical fallback is not authoritative in scanMainGrid'
);

assert.ok(
    !source.includes(
        'afterFallbackPi'
    ),
    'stale native page_info can still override canonical fallback'
);

/*
 * Native PROFILE capture must be scoped to a known profile query targeting
 * the current profile. URL/currentProfile alone is not enough.
 */
const captureGridSource =
    extractFunction(
        'captureGrid'
    );

assert.ok(
    captureGridSource.includes(
        'GRID_NAMES.has'
    ),
    'captureGrid accepts unknown GraphQL query families'
);

assert.ok(
    captureGridSource.includes(
        'requestTargetsCurrentProfile'
    ),
    'captureGrid does not verify the request target'
);

const gridUserSource =
    extractFunction(
        'gridUser'
    );

assert.ok(
    !gridUserSource.includes(
        'currentProfile()'
    ),
    'gridUser still attributes anonymous requests from the current URL alone'
);

/*
 * Native-profile completion must replay a successful captured Relay
 * contract, not a fixed doc_id and hand-built variable list.
 */
const fallbackSource =
    extractFunction('scanProfileGraphQLFallback');

assert.ok(
    fallbackSource.includes('profileNativeCompletionRequest'),
    'native request template is not used for completion'
);
assert.ok(
    fallbackSource.includes('webRelayGql('),
    'legacy bare gql() call returned'
);
assert.ok(
    fallbackSource.includes('nativeTemplate:native.template'),
    'native Relay payload is not replayed'
);
assert.ok(
    fallbackSource.includes("endReason:'native_contract_unavailable'"),
    'no-contract state must remain incomplete'
);
assert.ok(
    !fallbackSource.includes('APP.PROFILE_FALLBACK_DOC'),
    'static legacy profile doc ID is still forced'
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
    'PROFILE completion proof regression tests passed.'
);
