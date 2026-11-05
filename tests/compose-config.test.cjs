'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createComposeConfig } = require('../src/compose-config.cjs');

test('Compose config persists state, mounts only the Astra workspace and binds loopback', () => {
  const config = createComposeConfig({
    stateDir: 'C:/Users/test/AppData/Roaming/Astra Workstation/openhands',
    projectsDir: 'D:/Astra/projects',
    image: 'ghcr.io/openhands/agent-canvas:1.35.0',
    hostPort: 18000,
  });

  assert.match(config, /127\.0\.0\.1:18000:8000/);
  assert.match(config, /restart: unless-stopped/);
  assert.match(config, /ghcr\.io\/openhands\/agent-canvas:1\.35\.0/);
  assert.match(config, /C:\/Users\/test\/AppData\/Roaming\/Astra Workstation\/openhands:\/home\/openhands\/\.openhands/);
  assert.match(config, /D:\/Astra\/projects:\/projects/);
  assert.doesNotMatch(config, /0\.0\.0\.0:18000/);
});

test('Compose config escapes YAML-sensitive paths', () => {
  const config = createComposeConfig({
    stateDir: 'C:/Users/O\"Neil/state',
    projectsDir: 'C:/Users/O\"Neil/projects',
    image: 'ghcr.io/openhands/agent-canvas:1.35.0',
    hostPort: 18000,
  });
  assert.match(config, /O\\\"Neil/);
});
