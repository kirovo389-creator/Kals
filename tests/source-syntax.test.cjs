'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const files = [
  'src/main.cjs',
  'src/preload.cjs',
  'src/native-runtime.cjs',
  'src/browser-proxy.cjs',
  'scripts/after-pack.cjs',
  'electron-builder.config.cjs',
  'scripts/download-runtimes.mjs',
];

test('Electron and build entry points have valid JavaScript syntax', () => {
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', path.resolve(__dirname, '..', file)], {
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(result.status, 0, file + ': ' + (result.stderr || result.stdout));
  }
});
