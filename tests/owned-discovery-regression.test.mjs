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

    const braceStart =
        source.indexOf(
            '{',
            start
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

const membershipSource =
    extractFunction(
        'registerOwnedRootMembership'
    );

const ownedIdsSource =
    extractFunction(
        'ownedIds'
    );

const ownedCountSource =
    extractFunction(
        'ownedCount'
    );

const discoverySource =
    extractFunction(
        'ownedDiscoveryCoverage'
    );

const state = {
    roots: {
        POST:
            new Set(),
        REEL:
            new Set(),
    },

    coverage: {
        profileGrid: false,
        publicShadow: false,
        connectedHidden: false,
        reels: false,
    },
};

const scanSelection =
    () => ({
        post: true,
        reel: true,
    });

const helpers =
    new Function(
        'state',
        'scanSelection',
        `${ownedIdsSource}
${ownedCountSource}
${membershipSource}
${discoverySource}
return {
    ownedIds,
    ownedCount,
    registerOwnedRootMembership,
    ownedDiscoveryCoverage,
};`
    )(
        state,
        scanSelection
    );

/*
 * Exact _pauline_ka shape after PROFILE:
 * 9 roots provisionally classified as POST.
 */
for (
    const id
    of [
        'P1',
        'P2',
        'P3',
        'P4',
        'P5',
        'P6',
        'P7',
        'P8',
        'OVERLAP',
    ]
) {
    helpers.registerOwnedRootMembership(
        id,
        'POST'
    );
}

assert.equal(
    state.roots.POST.size,
    9
);

assert.equal(
    helpers.ownedCount(),
    9
);

/*
 * REELS proves seven Reel roots, one of which was provisionally present
 * in the mixed PROFILE grid. It must be moved, not double-counted.
 */
for (
    const id
    of [
        'OVERLAP',
        'R2',
        'R3',
        'R4',
        'R5',
        'R6',
        'R7',
    ]
) {
    helpers.registerOwnedRootMembership(
        id,
        'REEL'
    );
}

assert.equal(
    state.roots.POST.size,
    8,
    'confirmed REEL root remained in POST'
);

assert.equal(
    state.roots.REEL.size,
    7
);

assert.equal(
    helpers.ownedCount(),
    15
);

assert.ok(
    !state.roots.POST.has(
        'OVERLAP'
    )
);

assert.ok(
    state.roots.REEL.has(
        'OVERLAP'
    )
);

/*
 * A later ambiguous PROFILE observation must not downgrade a confirmed Reel.
 */
helpers.registerOwnedRootMembership(
    'OVERLAP',
    'POST'
);

assert.equal(
    state.roots.POST.size,
    8,
    'POST observation downgraded a confirmed REEL'
);

assert.equal(
    state.roots.REEL.size,
    7
);

/*
 * Discovery completion is coverage-based, never media_count-based.
 * This deliberately models IG counter=21 with 15 accessible roots.
 */
state.coverage.profileGrid = true;
state.coverage.publicShadow = true;
state.coverage.connectedHidden = true;
state.coverage.reels = true;

const complete =
    helpers.ownedDiscoveryCoverage({
        post: true,
        reel: true,
    });

assert.equal(
    complete.completed,
    4
);

assert.equal(
    complete.total,
    4
);

assert.equal(
    complete.ratio,
    1
);

assert.equal(
    complete.complete,
    true
);

state.coverage.reels = false;

const incomplete =
    helpers.ownedDiscoveryCoverage({
        post: true,
        reel: true,
    });

assert.equal(
    incomplete.completed,
    3
);

assert.equal(
    incomplete.total,
    4
);

assert.equal(
    incomplete.ratio,
    0.75
);

assert.equal(
    incomplete.complete,
    false
);

assert.ok(
    !source.includes(
        'owned / expected'
    ),
    'DISCOVERY reverted to Instagram counter ratio'
);

assert.ok(
    source.includes(
        'IG counter'
    ),
    'Instagram counter is no longer exposed as informational context'
);

assert.ok(
    source.includes(
        '<b>${owned}</b>'
    ),
    'OWNED metric still implies the Instagram counter is authoritative'
);

const metadataVersion =
    source.match(
        /\/\/ @version\s+([0-9.]+)/
    )?.[1];

const appVersion =
    source.match(
        /VERSION:\s*'([0-9.]+)'/
    )?.[1];

assert.equal(
    metadataVersion,
    appVersion
);

console.log(
    'Owned discovery semantics regression tests passed.'
);
