'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function windowsDockerPath(input) {
  return path.resolve(input).replace(/\\/g, '/');
}

function rootAlias(input, index = 0) {
  const base = path.basename(path.resolve(input)).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'folder';
  const hash = crypto.createHash('sha1').update(path.resolve(input).toLowerCase()).digest('hex').slice(0, 7);
  return `${base}-${hash}-${index}`;
}

function createComposeConfig({ stateDir, projectsDir, workspaceRoots = [], image, hostPort = 18000 }) {
  if (!stateDir || !projectsDir || !image) {
    throw new TypeError('stateDir, projectsDir and image are required');
  }
  if (!Number.isInteger(hostPort) || hostPort < 1024 || hostPort > 65535) {
    throw new RangeError('hostPort must be an integer between 1024 and 65535');
  }

  const mounts = [
    `${windowsDockerPath(stateDir)}:/home/openhands/.openhands`,
    `${windowsDockerPath(projectsDir)}:/projects`,
  ];
  const seen = new Set([path.resolve(projectsDir).toLowerCase()]);
  let index = 0;
  for (const root of workspaceRoots) {
    if (!root) continue;
    const resolved = path.resolve(root);
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mounts.push(`${windowsDockerPath(resolved)}:/projects/roots/${rootAlias(resolved, index++)}`);
  }

  return [
    'services:',
    '  astra-agent-canvas:',
    `    image: ${yamlQuote(image)}`,
    '    container_name: astra-agent-canvas',
    '    restart: unless-stopped',
    '    init: true',
    '    ports:',
    `      - ${yamlQuote(`127.0.0.1:${hostPort}:8000`)}`,
    '    extra_hosts:',
    '      - "host.docker.internal:host-gateway"',
    '    environment:',
    '      AGENT_CANVAS_ALLOW_LAN_SESSION_KEY: "true"',
    '    volumes:',
    ...mounts.map(mount => `      - ${yamlQuote(mount)}`),
    '    stop_grace_period: 30s',
    '',
  ].join('\\n');
}

module.exports = { createComposeConfig, windowsDockerPath, rootAlias };
