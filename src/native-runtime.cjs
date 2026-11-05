'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_HOST = '127.0.0.1';

function getOpenHandsPaths(homeDir) {
  if (typeof homeDir !== 'string' || !homeDir.trim()) throw new TypeError('homeDir is required');
  const openHandsDir = path.join(homeDir, '.openhands');
  return {
    openHandsDir,
    stateDir: path.join(openHandsDir, 'agent-canvas'),
    mcpConfigPath: path.join(openHandsDir, 'mcp.json'),
  };
}

function getAgentCanvasCliPath({ isPackaged, appPath, projectRoot }) {
  const root = isPackaged ? appPath : projectRoot;
  if (!root) throw new TypeError('appPath or projectRoot is required');
  return path.join(root, 'node_modules', '@openhands', 'agent-canvas', 'bin', 'agent-canvas.mjs');
}

function getRuntimeRoot({ isPackaged, resourcesPath, projectRoot }) {
  if (isPackaged) {
    if (!resourcesPath) throw new TypeError('resourcesPath is required for packaged runtime');
    return resourcesPath;
  }
  if (!projectRoot) throw new TypeError('projectRoot is required for development runtime');
  return path.join(projectRoot, 'resources');
}

function buildNativeRuntimeEnv({ baseEnv = process.env, homeDir, stateDir, runtimeRoot }) {
  if (!homeDir || !stateDir || !runtimeRoot) {
    throw new TypeError('homeDir, stateDir and runtimeRoot are required');
  }
  const nodeDir = path.join(runtimeRoot, 'node');
  const binDir = path.join(runtimeRoot, 'bin');
  const pathEntries = [binDir, nodeDir, baseEnv.PATH].filter(Boolean);
  return {
    ...baseEnv,
    HOME: homeDir,
    USERPROFILE: homeDir,
    OH_BIND_HOST: DEFAULT_HOST,
    OH_CANVAS_SAFE_STATE_DIR: stateDir,
    UV_CACHE_DIR: path.join(path.dirname(stateDir), 'uv-cache'),
    UV_TOOL_DIR: path.join(path.dirname(stateDir), 'uv-tools'),
    PATH: pathEntries.join(path.delimiter),
  };
}

function browserMcpUrl(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new RangeError('port must be an integer between 1024 and 65535');
  }
  return 'http://' + DEFAULT_HOST + ':' + port + '/mcp';
}

function rootAlias(root) {
  if (typeof root !== 'string' || !root.trim()) throw new TypeError('root is required');
  const base = path.basename(path.resolve(root)).toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'folder';
  const hash = crypto.createHash('sha1')
    .update(path.resolve(root).toLowerCase())
    .digest('hex')
    .slice(0, 8);
  return base + '-' + hash;
}

module.exports = {
  DEFAULT_HOST,
  getOpenHandsPaths,
  getAgentCanvasCliPath,
  getRuntimeRoot,
  buildNativeRuntimeEnv,
  browserMcpUrl,
  rootAlias,
};
