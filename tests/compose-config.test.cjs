'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createComposeConfig, rootAlias } = require('../src/compose-config.cjs');

test('Compose config persists state, mounts the Astra workspace and binds loopback', () => {
  const config = createComposeConfig({
    stateDir: 'C:/Users/test/AppData/Roaming/Astra Workstation/openhands',
    projectsDir: 'D:/Astra/projects',
    image: 'ghcr.io/openhands/agent-canvas:1.35.0',
    hostPort: 18000,
  });

  assert.ok(config.includes('127.0.0.1:18000:8000'));
  assert.ok(config.includes('restart: unless-stopped'));
  assert.ok(config.includes('ghcr.io/openhands/agent-canvas:1.35.0'));
  assert.ok(config.includes('C:/Users/test/AppData/Roaming/Astra Workstation/openhands:/home/openhands/.openhands'));
  assert.ok(config.includes('D:/Astra/projects:/projects'));
  assert.ok(config.includes('host.docker.internal:host-gateway'));
  assert.ok(!config.includes('0.0.0.0:18000'));
});

test('Compose config mounts user-selected folders under the workspace roots directory', () => {
  const root = 'E:/Code/My Game';
  const config = createComposeConfig({
    stateDir: 'C:/Astra/state',
    projectsDir: 'D:/Astra/projects',
    workspaceRoots: [root, 'D:/Astra/projects', root],
    image: 'ghcr.io/openhands/agent-canvas:1.35.0',
  });
  assert.ok(config.includes('E:/Code/My Game:/projects/roots/my-game-'));
  assert.equal((config.match(/E:\/Code\/My Game/g) || []).length, 1);
  assert.ok(rootAlias(root).startsWith('my-game-'));
});

test('Compose config escapes YAML-sensitive paths', () => {
  const config = createComposeConfig({
    stateDir: 'C:/Users/O"Neil/state',
    projectsDir: 'C:/Users/O"Neil/projects',
    image: 'ghcr.io/openhands/agent-canvas:1.35.0',
    hostPort: 18000,
  });
  const expectedMount = JSON.stringify('C:/Users/O"Neil/state:/home/openhands/.openhands');
  assert.ok(config.includes(expectedMount));
});
