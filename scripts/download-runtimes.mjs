#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCES = join(ROOT, 'resources');
const NODE_VERSION = '24.22.1';
const UV_VERSION = '0.13.7';
const NODE_ARCHIVE = 'node-v' + NODE_VERSION + '-win-x64.zip';
const NODE_SHA256 = 'd2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5';
const UV_ARCHIVE = 'uv-x86_64-pc-windows-msvc.zip';
const UV_SHA256 = '0cdc5b38fe5a8168ed6a25814f5ba43c21d313dd3187314fccb37b7cec46e021';

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error('Download failed: ' + url + ' (HTTP ' + response.status + ')');
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function verifyHash(filePath, expected, label) {
  const actual = sha256(filePath);
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(label + ' SHA-256 mismatch. Expected ' + expected + ', got ' + actual);
  }
}

function extractZip(archive, destination) {
  mkdirSync(destination, { recursive: true });
  execFileSync('tar', ['-xf', archive, '-C', destination], { stdio: 'inherit' });
}

function findFile(root, filename) {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) return fullPath;
      if (entry.isDirectory()) stack.push(fullPath);
    }
  }
  return null;
}

async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Astra 0.3.0 Windows runtime bundles are built only on win32/x64.');
  }

  const nodeDir = join(RESOURCES, 'node');
  const uvDir = join(RESOURCES, 'bin');
  const nodeExe = join(nodeDir, 'node.exe');
  const npmCmd = join(nodeDir, 'npm.cmd');
  const npxCmd = join(nodeDir, 'npx.cmd');
  const uvExe = join(uvDir, 'uv.exe');
  const uvxExe = join(uvDir, 'uvx.exe');
  const npmCli = join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');

  if ([nodeExe, npmCmd, npxCmd, npmCli, uvExe, uvxExe].every(existsSync) && !process.argv.includes('--force')) {
    console.log('[runtime] Bundled Node.js and uv are already present.');
    return;
  }

  const temp = mkdtempSync(join(tmpdir(), 'astra-runtime-'));
  try {
    const nodeZip = join(temp, NODE_ARCHIVE);
    const uvZip = join(temp, UV_ARCHIVE);
    const nodeExtract = join(temp, 'node');
    const uvExtract = join(temp, 'uv');

    console.log('[runtime] Downloading Node.js ' + NODE_VERSION + ' x64…');
    await download('https://nodejs.org/dist/v' + NODE_VERSION + '/' + NODE_ARCHIVE, nodeZip);
    verifyHash(nodeZip, NODE_SHA256, 'Node.js archive');
    extractZip(nodeZip, nodeExtract);

    console.log('[runtime] Downloading uv ' + UV_VERSION + ' x64…');
    await download('https://github.com/astral-sh/uv/releases/download/' + UV_VERSION + '/' + UV_ARCHIVE, uvZip);
    verifyHash(uvZip, UV_SHA256, 'uv archive');
    extractZip(uvZip, uvExtract);

    const foundNode = findFile(nodeExtract, 'node.exe');
    const foundUv = findFile(uvExtract, 'uv.exe');
    const foundUvx = findFile(uvExtract, 'uvx.exe');
    if (!foundNode) throw new Error('Expected bundled runtime file was not found: node.exe');
    if (!foundUv) throw new Error('Expected bundled runtime file was not found: uv.exe');
    if (!foundUvx) throw new Error('Expected bundled runtime file was not found: uvx.exe');

    const nodeRoot = dirname(foundNode);
    mkdirSync(RESOURCES, { recursive: true });
    rmSync(nodeDir, { recursive: true, force: true });
    rmSync(uvDir, { recursive: true, force: true });
    cpSync(nodeRoot, nodeDir, { recursive: true });
    mkdirSync(uvDir, { recursive: true });
    cpSync(foundUv, uvExe);
    cpSync(foundUvx, uvxExe);

    for (const required of [npmCmd, npxCmd, npmCli, uvExe, uvxExe]) {
      if (!existsSync(required)) throw new Error('Node.js/uv distribution is incomplete: ' + required);
    }

    const nodeVersion = execFileSync(nodeExe, ['--version'], { encoding: 'utf8' }).trim();
    const uvVersion = execFileSync(uvExe, ['--version'], { encoding: 'utf8' }).trim();
    const uvxVersion = execFileSync(uvxExe, ['--version'], { encoding: 'utf8' }).trim();
    if (nodeVersion !== 'v' + NODE_VERSION) throw new Error('Unexpected bundled Node version: ' + nodeVersion);
    if (!uvVersion.includes(UV_VERSION) || !uvxVersion.includes(UV_VERSION)) {
      throw new Error('Unexpected bundled uv versions: ' + uvVersion + ' / ' + uvxVersion);
    }

    console.log('[runtime] Verified ' + nodeVersion + ', ' + uvVersion + ', ' + uvxVersion);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error('[runtime] ' + (error?.stack || error));
  process.exitCode = 1;
});
