'use strict';

const path = require('node:path');
const packageJson = require('./package.json');
const { restoreWindowsNpm } = require('./scripts/after-pack.cjs');

module.exports = {
  ...packageJson.build,
  afterPack: context => restoreWindowsNpm(context, { projectRoot: __dirname }),
};
