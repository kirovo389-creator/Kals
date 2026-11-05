'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

async function restoreWindowsNpm(context, options = {}) {
  if (context.electronPlatformName !== 'win32') return;

  const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
  const resourcesRoot = path.join(context.appOutDir, 'resources');
  const sourceNpm = path.join(projectRoot, 'resources', 'node', 'node_modules', 'npm');
  const destinationNpm = path.join(resourcesRoot, 'node', 'node_modules', 'npm');
  const sourceCli = path.join(sourceNpm, 'bin', 'npm-cli.js');

  try {
    await fs.access(sourceCli);
  } catch {
    throw new Error('Bundled Node.js npm package is missing from resources/node/node_modules/npm.');
  }

  await fs.mkdir(path.dirname(destinationNpm), { recursive: true });
  await fs.rm(destinationNpm, { recursive: true, force: true });
  await fs.cp(sourceNpm, destinationNpm, { recursive: true });

  const packagedCli = path.join(destinationNpm, 'bin', 'npm-cli.js');
  await fs.access(packagedCli);
}

module.exports = { restoreWindowsNpm };
