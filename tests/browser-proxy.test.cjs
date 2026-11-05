'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createProxyServer } = require('../src/browser-proxy.cjs');

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

test('Browser MCP gateway rejects requests without its bearer token and proxies authorized requests', async () => {
  const upstream = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('browser-mcp-ok');
  });
  const upstreamPort = await listen(upstream);
  const proxy = createProxyServer({ token: 'test-secret', upstreamPort });
  const proxyPort = await listen(proxy);

  try {
    const denied = await fetch(`http://127.0.0.1:${proxyPort}/mcp`);
    assert.equal(denied.status, 401);

    const allowed = await fetch(`http://127.0.0.1:${proxyPort}/mcp`, {
      headers: { Authorization: 'Bearer test-secret' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(await allowed.text(), 'browser-mcp-ok');
  } finally {
    await close(proxy);
    await close(upstream);
  }
});
