'use strict';

const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function createProxyServer({ token, upstreamHost = '127.0.0.1', upstreamPort = 8932 }) {
  if (!token) throw new TypeError('A browser MCP access token is required');

  return http.createServer((request, response) => {
    if (!safeEqual(request.headers.authorization || '', `Bearer ${token}`)) {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Unauthorized browser MCP request' }));
      return;
    }

    const headers = { ...request.headers, host: `${upstreamHost}:${upstreamPort}` };
    delete headers.authorization;
    const upstream = http.request({
      hostname: upstreamHost,
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers,
    }, upstreamResponse => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });

    upstream.on('error', error => {
      if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Browser MCP upstream unavailable', detail: error.message }));
    });

    request.pipe(upstream);
  });
}

if (require.main === module) {
  const server = createProxyServer({
    token: process.env.ASTRA_BROWSER_MCP_TOKEN,
    upstreamHost: process.env.ASTRA_BROWSER_MCP_UPSTREAM_HOST || '127.0.0.1',
    upstreamPort: Number(process.env.ASTRA_BROWSER_MCP_UPSTREAM_PORT || 8932),
  });
  const port = Number(process.env.ASTRA_BROWSER_MCP_PROXY_PORT || 8931);
  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`Astra browser MCP gateway listening on ${port}\n`);
  });
}

module.exports = { createProxyServer };
