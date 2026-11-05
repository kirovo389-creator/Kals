'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { restoreWindowsNpm } = require('../scripts/after-pack.cjs');

test('afterPack restores the Windows Node npm package into packaged resources', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'astra-after-pack-'));
  const projectRoot = path.join(root, 'project');
  const appOutDir = path.join(root, 'win-unpacked');
  const sourceCli = path.join(projectRoot, 'resources', 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const targetCli = path.join(appOutDir, 'resources', 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js');

  try {
    await fs.mkdir(path.dirname(sourceCli), { recursive: true });
    await fs.writeFile(sourceCli, 'source npm cli', 'utf8');

    await restoreWindowsNpm({
      electronPlatformName: 'win32',
      appOutDir,
    }, { projectRoot });

    assert.equal(await fs.readFile(targetCli, 'utf8'), 'source npm cli');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('afterPack does not alter non-Windows resources', async () => {
  await restoreWindowsNpm({
    electronPlatformName: 'linux',
    appOutDir: '/not-used',
  }, { projectRoot: '/not-used' });
});

test('afterPack fails the build when the source npm CLI is missing', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'astra-after-pack-missing-'));
  try {
    await assert.rejects(
      restoreWindowsNpm({
        electronPlatformName: 'win32',
        appOutDir: path.join(root, 'win-unpacked'),
      }, { projectRoot: root }),
      /npm package is missing/,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
