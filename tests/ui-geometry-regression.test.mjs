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

const safeBoundsSource =
    extractFunction(
        'panelSafeBounds'
    );

const horizontalSource =
    extractFunction(
        'panelHorizontalPosition'
    );

const APP = {
    PANEL_MARGIN_X: 16,
    PANEL_MARGIN_Y: 12,
};

const helpers =
    new Function(
        'APP',
        `${safeBoundsSource}
${horizontalSource}
return {
    panelSafeBounds,
    panelHorizontalPosition,
};`
    )(
        APP
    );

function viewport(
    left,
    top,
    width,
    height
) {
    return {
        left,
        top,
        width,
        height,
        right:
            left + width,
        bottom:
            top + height,
    };
}

const desktop =
    viewport(
        0,
        0,
        1920,
        1152
    );

const fullRight =
    helpers.panelHorizontalPosition(
        desktop,
        420,
        'right',
        16
    );

assert.equal(
    fullRight.left,
    1484,
    '420px panel lost the 16px right margin'
);

assert.equal(
    fullRight.left +
        fullRight.width,
    1904,
    '420px panel touches or exceeds viewport right edge'
);

assert.equal(
    fullRight.gapX,
    16
);

const miniRight =
    helpers.panelHorizontalPosition(
        desktop,
        118,
        'right',
        16
    );

assert.equal(
    miniRight.left,
    1786
);

assert.equal(
    miniRight.left +
        miniRight.width,
    1904,
    'mini state changed the anchored right edge'
);

const restoredRight =
    helpers.panelHorizontalPosition(
        desktop,
        420,
        miniRight.anchor,
        miniRight.gapX
    );

assert.deepEqual(
    restoredRight,
    fullRight,
    'mini -> restore did not preserve the same right anchor'
);

const legacyFlushRight =
    helpers.panelHorizontalPosition(
        desktop,
        420,
        'right',
        0
    );

assert.equal(
    legacyFlushRight.left,
    1484,
    'legacy zero-gap state was not migrated into the safe margin'
);

assert.equal(
    legacyFlushRight.gapX,
    16
);

const customGap =
    helpers.panelHorizontalPosition(
        desktop,
        420,
        'right',
        48
    );

assert.equal(
    customGap.left,
    1452
);

assert.equal(
    customGap.gapX,
    48,
    'user-selected right gap was not preserved'
);

const fullLeft =
    helpers.panelHorizontalPosition(
        desktop,
        420,
        'left',
        16
    );

assert.equal(
    fullLeft.left,
    16
);

assert.equal(
    fullLeft.gapX,
    16
);

const offsetViewport =
    viewport(
        100,
        50,
        800,
        600
    );

const offsetRight =
    helpers.panelHorizontalPosition(
        offsetViewport,
        420,
        'right',
        16
    );

assert.equal(
    offsetRight.left,
    464
);

assert.equal(
    offsetRight.left +
        offsetRight.width,
    884,
    'visualViewport offset/right margin calculation is wrong'
);

const narrowViewport =
    viewport(
        0,
        0,
        300,
        600
    );

const narrow =
    helpers.panelHorizontalPosition(
        narrowViewport,
        420,
        'right',
        16
    );

assert.equal(
    narrow.width,
    268,
    'panel was not reduced to safe viewport width'
);

assert.equal(
    narrow.left,
    16
);

assert.equal(
    narrow.left +
        narrow.width,
    284,
    'narrow viewport lost the right safe margin'
);

for (
    const obsolete
    of [
        'function applySavedUiState(',
        'function setMiniState(',
        'function installPanelDrag(',
    ]
) {
    assert.ok(
        !source.includes(
            obsolete
        ),
        `obsolete split geometry path returned: ${obsolete}`
    );
}

assert.ok(
    source.includes(
        'function installPanelController('
    ),
    'unified panel controller missing'
);

assert.ok(
    source.includes(
        'UI_LAYOUT_VERSION: 2'
    ),
    'panel layout state was not versioned'
);

console.log(
    'Panel geometry regression tests passed.'
);
