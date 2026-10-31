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

function meta(name) {
    return source.match(
        new RegExp(
            '^// @' + name + '\\s+(.+)$',
            'm'
        )
    )?.[1]?.trim() || '';
}

const expectedRepo =
    'https://github.com/JKL93sang/JKL-Instagram-Backup';

const expectedRaw =
    'https://raw.githubusercontent.com/JKL93sang/JKL-Instagram-Backup/fix/public-post-reel-reconciliation/JKL_Instagram_Backup.user.js';

assert.equal(
    meta('name'),
    'JKL Instagram Backup'
);

assert.equal(
    meta('namespace'),
    'https://jkl.local/',
    'namespace must remain stable so existing installs keep the same script identity'
);

assert.equal(
    meta('homepageURL'),
    expectedRepo
);

assert.equal(
    meta('supportURL'),
    expectedRepo + '/issues'
);

assert.equal(
    meta('source'),
    expectedRepo + '/blob/fix/public-post-reel-reconciliation/JKL_Instagram_Backup.user.js'
);

assert.equal(
    meta('updateURL'),
    expectedRaw
);

assert.equal(
    meta('downloadURL'),
    expectedRaw
);

assert.equal(
    meta('license'),
    'MIT'
);

const metadataVersion =
    meta('version');

const appVersion =
    source.match(
        /VERSION:\s*'([0-9.]+)'/
    )?.[1];

assert.ok(metadataVersion);
assert.equal(metadataVersion, '1.5.66');
assert.equal(metadataVersion, appVersion);
assert.match(meta('description'), /Instagram backup:/);
assert.match(meta('description'), /TEST BUILD: POST\/REEL reconciliation/,
    'Experimental branch must be explicitly identified as a test build');


assert.ok(
    !source.includes(
        'JKL93sang/Tapermonkey'
    ),
    'public userscript still references the private development repository'
);

console.log(
    'Public distribution metadata regression tests passed.'
);
