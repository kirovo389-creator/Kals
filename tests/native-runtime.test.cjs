'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  AGENT_SERVER_PORT,
  AUTOMATION_PORT,
  getOpenHandsPaths,
  getAgentCanvasCliPath,
  getRuntimeRoot,
  buildNativeRuntimeEnv,
  browserMcpUrl,
  rootAlias,
} = require('../src/native-runtime.cjs');

test('OpenHands paths preserve the standard Windows home layout', () => {
  const home = path.join('C:', 'Users', 'Astra');
  const result = getOpenHandsPaths(home);
  assert.equal(result.openHandsDir, path.join(home, '.openhands'));
  assert.equal(result.stateDir, path.join(home, '.openhands', 'agent-canvas'));
  assert.equal(result.mcpConfigPath, path.join(home, '.openhands', 'mcp.json'));
});

test('packaged and development CLI paths resolve the official local package', () => {
  const expected = path.join('app', 'node_modules', '@openhands', 'agent-canvas', 'bin', 'agent-canvas.mjs');
  assert.equal(getAgentCanvasCliPath({ isPackaged: true, appPath: 'app' }), expected);
  assert.equal(getAgentCanvasCliPath({ isPackaged: false, projectRoot: 'app' }), expected);
});

test('runtime root is resolved to resources in both installed and development builds', () => {
  assert.equal(getRuntimeRoot({ isPackaged: true, resourcesPath: 'installed/resources' }), 'installed/resources');
  assert.equal(getRuntimeRoot({ isPackaged: false, projectRoot: 'checkout' }), path.join('checkout', 'resources'));
});

test('native runtime environment places bundled tools first and preserves inherited variables', () => {
  const result = buildNativeRuntimeEnv({
    baseEnv: { PATH: 'system-path', KEEP_ME: 'yes' },
    homeDir: '/home/test',
    stateDir: '/home/test/.openhands/agent-canvas',
    runtimeRoot: '/opt/astra/resources',
  });
  const entries = result.PATH.split(path.delimiter);
  assert.equal(entries[0], path.join('/opt/astra/resources', 'bin'));
  assert.equal(entries[1], path.join('/opt/astra/resources', 'node'));
  assert.equal(entries[2], 'system-path');
  assert.equal(result.HOME, '/home/test');
  assert.equal(result.USERPROFILE, '/home/test');
  assert.equal(result.OH_BIND_HOST, '127.0.0.1');
  assert.equal(result.OH_CANVAS_SAFE_STATE_DIR, '/home/test/.openhands/agent-canvas');
  assert.equal(AGENT_SERVER_PORT, 18100);
  assert.equal(AUTOMATION_PORT, 18101);
  assert.equal(result.OH_CANVAS_SAFE_BACKEND_PORT, '18100');
  assert.equal(result.OH_CANVAS_SAFE_AUTOMATION_PORT, '18101');
  assert.equal(result.KEEP_ME, 'yes');
  assert.ok(!result.PATH.includes('host.docker.internal'));
});

test('browser MCP endpoint uses loopback rather than Docker host routing', () => {
  assert.equal(browserMcpUrl(18931), 'http://127.0.0.1:18931/mcp');
  assert.throws(() => browserMcpUrl(80), RangeError);
});

test('workspace aliases are stable and filesystem-safe', () => {
  const first = rootAlias('D:/Code/My Game');
  const second = rootAlias('D:/Code/My Game');
  assert.equal(first, second);
  assert.match(first, /^my-game-[a-f0-9]{8}$/);
});

test('native services avoid the legacy 0.2.0 Docker ingress port', () => {
  assert.notEqual(AGENT_SERVER_PORT, 18000);
  assert.notEqual(AUTOMATION_PORT, 18000);
  assert.notEqual(AGENT_SERVER_PORT, AUTOMATION_PORT);
});
