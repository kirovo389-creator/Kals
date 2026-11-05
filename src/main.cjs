'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { promisify } = require('node:util');
const { createComposeConfig } = require('./compose-config.cjs');

const execFileAsync = promisify(execFile);
const APP_NAME = 'Astra Workstation';
const IMAGE = 'ghcr.io/openhands/agent-canvas:1.35.0';
const HOST_PORT = 18000;
const BROWSER_MCP_PORT = 18931;
const BROWSER_MCP_UPSTREAM_PORT = 18932;
const BASE_URL = `http://127.0.0.1:${HOST_PORT}`;
const DOCKER_DESKTOP_EXE = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
let mainWindow;
let startPromise;


function isPortOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(700);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

async function waitForPort(port, host = '127.0.0.1', timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port, host)) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Browser service did not open port ${port} in time. Check the browser MCP log in Astra's app-data folder.`);
}

function getRuntimeScriptPath(relativePath) {
  if (!app.isPackaged) return path.join(__dirname, relativePath);
  return path.join(process.resourcesPath, 'app.asar.unpacked', relativePath);
}

function spawnBundledNode(scriptPath, args, env, logPath) {
  const logFd = fsSync.openSync(logPath, 'a');
  const child = spawn(process.execPath, [scriptPath, ...args], {
    detached: true,
    windowsHide: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...env },
  });
  child.unref();
  fsSync.closeSync(logFd);
  return child;
}

async function ensureBrowserMcp(stateDir) {
  const userData = app.getPath('userData');
  const profileDir = path.join(userData, 'browser-profile');
  const downloadsDir = path.join(app.getPath('documents'), 'Astra Workstation', 'downloads');
  const logsDir = path.join(userData, 'logs');
  const tokenPath = path.join(userData, 'browser-mcp.token');
  const mcpConfigPath = path.join(stateDir, 'mcp.json');
  await Promise.all([
    fs.mkdir(profileDir, { recursive: true }),
    fs.mkdir(downloadsDir, { recursive: true }),
    fs.mkdir(logsDir, { recursive: true }),
  ]);

  let token;
  try {
    token = (await fs.readFile(tokenPath, 'utf8')).trim();
  } catch {
    token = crypto.randomBytes(32).toString('hex');
    await fs.writeFile(tokenPath, token, { encoding: 'utf8', mode: 0o600 });
  }

  const mcpCli = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@playwright', 'mcp', 'cli.js')
    : path.join(__dirname, '..', 'node_modules', '@playwright', 'mcp', 'cli.js');
  const proxyScript = getRuntimeScriptPath('src/browser-proxy.cjs');
  if (!fsSync.existsSync(mcpCli)) throw new Error('Playwright MCP is missing from the Astra installation. Reinstall Astra using the latest installer.');
  if (!fsSync.existsSync(proxyScript)) throw new Error('Astra browser gateway is missing from the installation.');

  if (!await isPortOpen(BROWSER_MCP_UPSTREAM_PORT)) {
    sendStatus('Запускаю видимый браузер Microsoft Edge и подключаю Playwright…');
    spawnBundledNode(mcpCli, [
      '--host', '127.0.0.1',
      '--port', String(BROWSER_MCP_UPSTREAM_PORT),
      '--browser', 'msedge',
      '--user-data-dir', profileDir,
      '--output-dir', downloadsDir,
      '--shared-browser-context',
      '--caps', 'vision,pdf',
    ], { PLAYWRIGHT_MCP_PING_TIMEOUT_MS: '0' }, path.join(logsDir, 'browser-mcp.log'));
  }
  await waitForPort(BROWSER_MCP_UPSTREAM_PORT);

  if (!await isPortOpen(BROWSER_MCP_PORT)) {
    spawnBundledNode(proxyScript, [], {
      ASTRA_BROWSER_MCP_TOKEN: token,
      ASTRA_BROWSER_MCP_UPSTREAM_HOST: '127.0.0.1',
      ASTRA_BROWSER_MCP_UPSTREAM_PORT: String(BROWSER_MCP_UPSTREAM_PORT),
      ASTRA_BROWSER_MCP_PROXY_PORT: String(BROWSER_MCP_PORT),
    }, path.join(logsDir, 'browser-gateway.log'));
  }
  await waitForPort(BROWSER_MCP_PORT, '127.0.0.1');

  let config = {};
  try {
    config = JSON.parse(await fs.readFile(mcpConfigPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Cannot read MCP configuration: ${error.message}`);
  }
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.astra_browser = {
    url: `http://host.docker.internal:${BROWSER_MCP_PORT}/mcp`,
    headers: { Authorization: `Bearer ${token}` },
  };
  await fs.writeFile(mcpConfigPath, JSON.stringify(config, null, 2), 'utf8');
}

async function loadWorkspaceRoots(projectsDir) {
  const configPath = path.join(app.getPath('userData'), 'workspace-roots.json');
  let configured = [];
  try {
    const value = JSON.parse(await fs.readFile(configPath, 'utf8'));
    if (Array.isArray(value)) configured = value.filter(item => typeof item === 'string');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const roots = [projectsDir];
  for (const item of configured) {
    const resolved = path.resolve(item);
    if (fsSync.existsSync(resolved) && !roots.some(root => root.toLowerCase() === resolved.toLowerCase())) roots.push(resolved);
  }
  return roots;
}

function isProtectedWorkspaceRoot(candidate) {
  const root = path.resolve(candidate).toLowerCase();
  const driveRoot = path.parse(root).root.toLowerCase();
  if (root === driveRoot) return true;
  const protectedPaths = [
    process.env.SystemRoot || 'C:\\\\Windows',
    process.env.ProgramFiles || 'C:\\\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\\\Program Files (x86)',
    process.env.ProgramData || 'C:\\\\ProgramData',
    app.getPath('appData'),
    app.getPath('userData'),
  ].map(item => path.resolve(item).toLowerCase());
  const contains = (parent, child) => child === parent || child.startsWith(parent + path.sep);
  if (protectedPaths.some(item => contains(root, item) || contains(item, root))) return true;
  const sensitiveSegments = new Set(['.ssh', '.aws', '.azure', '.gnupg', 'appdata', 'credentials']);
  return root.split(path.sep).some(segment => sensitiveSegments.has(segment));
}

function sendStatus(message, kind = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('astra:status', { message, kind });
  }
}

async function run(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      windowsHide: true,
      timeout: options.timeout ?? 120000,
      maxBuffer: 8 * 1024 * 1024,
      cwd: options.cwd,
      env: process.env,
    });
    return { stdout: result.stdout || '', stderr: result.stderr || '' };
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message].filter(Boolean).join('\n').trim();
    throw new Error(detail || `${command} exited with code ${error.code ?? 'unknown'}`);
  }
}

function startDockerDesktop() {
  if (process.platform !== 'win32' || !fsSync.existsSync(DOCKER_DESKTOP_EXE)) return false;
  const child = spawn('cmd.exe', ['/c', 'start', '', DOCKER_DESKTOP_EXE], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return true;
}

async function waitForDocker() {
  try {
    await run('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 12000 });
    return;
  } catch {
    sendStatus('Docker Desktop не отвечает. Пытаюсь запустить его…');
  }

  const launched = startDockerDesktop();
  if (!launched) {
    throw new Error('Docker Desktop не найден. Установи Docker Desktop для Windows, включи WSL 2 backend и повтори запуск.');
  }

  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    try {
      await run('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 10000 });
      return;
    } catch {
      // Docker Desktop is still starting.
    }
  }
  throw new Error('Docker Desktop не запустился за 3 минуты. Проверь WSL 2 и перезапусти Docker Desktop.');
}

async function copyMissing(source, destination) {
  if (!fsSync.existsSync(source)) return;
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(source, entry.name);
    const dst = path.join(destination, entry.name);
    if (fsSync.existsSync(dst)) continue;
    if (entry.isDirectory()) {
      await copyMissing(src, dst);
    } else if (entry.isFile()) {
      await fs.copyFile(src, dst, fsSync.constants.COPYFILE_EXCL).catch(error => {
        if (error.code !== 'EEXIST') throw error;
      });
    }
  }
}

async function prepareWorkspace() {
  const documents = app.getPath('documents');
  const projectsDir = path.join(documents, 'Astra Workstation', 'projects');
  const starterDir = path.join(projectsDir, 'AstraGameDevStarter');
  const stateDir = path.join(app.getPath('userData'), 'openhands');
  const runtimeDir = path.join(app.getPath('userData'), 'runtime');

  await Promise.all([
    fs.mkdir(starterDir, { recursive: true }),
    fs.mkdir(stateDir, { recursive: true }),
    fs.mkdir(runtimeDir, { recursive: true }),
  ]);

  const starterSource = app.isPackaged
    ? path.join(process.resourcesPath, 'starter')
    : path.join(__dirname, '..', 'assets', 'starter');
  await copyMissing(starterSource, starterDir);

  const composeFile = path.join(runtimeDir, 'compose.yaml');
  const workspaceRoots = await loadWorkspaceRoots(projectsDir);
  const compose = createComposeConfig({ stateDir, projectsDir, workspaceRoots, image: IMAGE, hostPort: HOST_PORT });
  await fs.writeFile(composeFile, compose, 'utf8');

  return { projectsDir, starterDir, stateDir, composeFile, workspaceRoots };
}

async function waitForCanvas() {
  const deadline = Date.now() + 240000;
  let lastError = 'Сервер ещё запускается';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/server_info`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Agent Canvas не стал доступен за 4 минуты: ${lastError}`);
}

async function startRuntime() {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    const paths = await prepareWorkspace();
    sendStatus('Запускаю браузер с постоянным профилем…');
    await ensureBrowserMcp(paths.stateDir);
    sendStatus('Проверяю Docker Desktop…');
    await waitForDocker();

    sendStatus('Проверяю и загружаю образ Agent Canvas…');
    await run('docker', ['compose', '-f', paths.composeFile, 'pull'], { timeout: 1800000 });

    sendStatus('Запускаю постоянную Docker-песочницу…');
    await run('docker', ['compose', '-f', paths.composeFile, 'up', '-d'], { timeout: 300000 });

    sendStatus('Жду готовности Agent Canvas…');
    await waitForCanvas();
    sendStatus('Песочница готова. Открываю рабочее пространство.', 'success');
    return { url: BASE_URL, starterDir: paths.starterDir };
  })();

  try {
    return await startPromise;
  } catch (error) {
    startPromise = null;
    throw error;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    title: APP_NAME,
    backgroundColor: '#10131a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'start.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('astra:start', async () => {
  const result = await startRuntime();
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadURL(result.url);
  }
  return { ok: true, starterDir: result.starterDir };
});

ipcMain.handle('astra:open-project-folder', async () => {
  const documents = app.getPath('documents');
  const folder = path.join(documents, 'Astra Workstation', 'projects');
  await fs.mkdir(folder, { recursive: true });
  await shell.openPath(folder);
  return folder;
});

ipcMain.handle('astra:add-workspace-root', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths?.[0]) return { cancelled: true };
  const selected = await fs.realpath(result.filePaths[0]);
  if (isProtectedWorkspaceRoot(selected)) {
    throw new Error('Эту папку нельзя подключить целиком: она содержит системные файлы или хранилища учётных данных. Выбери конкретную рабочую папку, например Documents, Desktop, Downloads или папку с проектами.');
  }
  const configPath = path.join(app.getPath('userData'), 'workspace-roots.json');
  let roots = [];
  try {
    const value = JSON.parse(await fs.readFile(configPath, 'utf8'));
    if (Array.isArray(value)) roots = value.filter(item => typeof item === 'string');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!roots.some(item => path.resolve(item).toLowerCase() === selected.toLowerCase())) roots.push(selected);
  await fs.writeFile(configPath, JSON.stringify(roots, null, 2), 'utf8');
  return { cancelled: false, root: selected, restartRequired: true };
});

ipcMain.handle('astra:list-workspace-roots', async () => {
  const documents = app.getPath('documents');
  const projectsDir = path.join(documents, 'Astra Workstation', 'projects');
  return loadWorkspaceRoots(projectsDir);
});

ipcMain.handle('astra:open-docker', async () => {
  if (fsSync.existsSync(DOCKER_DESKTOP_EXE)) {
    const child = spawn(DOCKER_DESKTOP_EXE, [], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return true;
  }
  await shell.openExternal('https://www.docker.com/products/docker-desktop/');
  return false;
});

app.whenReady().then(() => {
  app.setAppUserModelId('dev.astra.workstation');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Deliberately do not run `docker compose down` here: the agent container is
// detached and persists tasks/state when the desktop window is closed.
