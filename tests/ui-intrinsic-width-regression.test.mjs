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

function cssContains(fragment, message) {
    assert.ok(
        source.includes(fragment),
        message
    );
}

cssContains(
    'contain:layout paint inline-size;',
    'root panel is not inline-size contained'
);

cssContains(
    '#jkl-igb .body *',
    'body descendants are not covered by the width invariant'
);

cssContains(
    'min-inline-size:0;',
    'shrinkable intrinsic minimum is missing'
);

cssContains(
    '#jkl-igb .body {\n                inline-size:100%;\n                max-inline-size:100%;\n                contain:inline-size;',
    'body inline-size containment is missing'
);

cssContains(
    'grid-template-columns:minmax(0,1fr);',
    'single-column grid still has an auto min-content track'
);

cssContains(
    'minmax(0,1fr)',
    'multi-column grids are not using shrinkable tracks'
);

cssContains(
    '#jkl-igb .progress-card,\n            #jkl-igb .jkl-compact-card {\n                inline-size:100%;\n                min-inline-size:0;\n                max-inline-size:100%;\n                contain:inline-size;\n                overflow:hidden;',
    'progress cards are not isolated from dynamic intrinsic width'
);

cssContains(
    '#jkl-igb .progress-detail {\n                display:block;\n                inline-size:100%;\n                min-inline-size:0;\n                max-inline-size:100%;\n                contain:inline-size;',
    'progress detail is not an isolated width-constrained text island'
);

cssContains(
    'white-space:nowrap;\n                overflow:hidden;\n                text-overflow:ellipsis;',
    'long download text is not ellipsized'
);

const oldDashboardPattern =
    /#jkl-igb \.dashboard \{[^}]*display:grid;[^}]*\}/s
        .exec(source)?.[0] || '';

assert.ok(
    !oldDashboardPattern.includes(
        'grid-template-columns:1fr'
    ),
    'dashboard reverted to an intrinsic min-content track'
);

const metricsPattern =
    /#jkl-igb \.jkl-metrics \{[^}]*\}/s
        .exec(source)?.[0] || '';

assert.ok(
    metricsPattern.includes(
        'minmax(0,1fr)'
    ),
    'metrics grid can still be widened by content'
);

const buttonsPattern =
    /#jkl-igb \.buttons \{[^}]*\}/s
        .exec(source)?.[0] || '';

assert.ok(
    buttonsPattern.includes(
        'minmax(0,1fr)'
    ),
    'buttons grid can still expose an auto intrinsic minimum'
);

const checksPattern =
    /#jkl-igb \.checks \{[^}]*\}/s
        .exec(source)?.[0] || '';

assert.ok(
    checksPattern.includes(
        'minmax(0,1fr)'
    ),
    'checks grid can still expose an auto intrinsic minimum'
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
    appVersion,
    'version mismatch'
);

console.log(
    'UI intrinsic-width regression tests passed.'
);
