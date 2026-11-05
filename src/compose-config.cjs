'use strict';

const path = require('node:path');

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function windowsDockerPath(input) {
  return path.resolve(input).replace(/\\/g, '/');
}

function createComposeConfig({ stateDir, projectsDir, image, hostPort = 18000 }) {
  if (!stateDir || !projectsDir || !image) {
    throw new TypeError('stateDir, projectsDir and image are required');
  }
  if (!Number.isInteger(hostPort) || hostPort < 1024 || hostPort > 65535) {
    throw new RangeError('hostPort must be an integer between 1024 and 65535');
  }

  const stateMount = `${windowsDockerPath(stateDir)}:/home/openhands/.openhands`;
  const projectsMount = `${windowsDockerPath(projectsDir)}:/projects`;

  return [
    'services:',
    '  astra-agent-canvas:',
    `    image: ${yamlQuote(image)}`,
    '    container_name: astra-agent-canvas',
    '    restart: unless-stopped',
    '    init: true',
    '    ports:',
    `      - ${yamlQuote(`127.0.0.1:${hostPort}:8000`)}`,
    '    environment:',
    '      AGENT_CANVAS_ALLOW_LAN_SESSION_KEY: "true"',
    '    volumes:',
    `      - ${yamlQuote(stateMount)}`,
    `      - ${yamlQuote(projectsMount)}`,
    '    stop_grace_period: 30s',
    '',
  ].join('\n');
}

module.exports = { createComposeConfig, windowsDockerPath };
