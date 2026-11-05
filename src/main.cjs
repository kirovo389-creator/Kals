'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const {
  buildNativeRuntimeEnv,
  getOpenHandsPaths,
  getAgentCanvasCliPath,
  getRuntimeRoot,
  browserMcpUrl,
  rootAlias,
} = require('./native-runtime.cjs');

const APP_NAME = 'Astra Workstation';
const HOST_PORT = 18080;
const BROWSER_MCP_PORT = 18931;
const BROWSER_MCP_UPSTREAM_PORT = 18932;
const BASE_URL = 'http://127.0.0.1:' + HOST_PORT;
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
  throw new Error('Browser service did not open port ' + port + ' in time. Check the browser MCP log in Astra\\'s app-data folder.');
}

function getRuntimeScriptPath(relativePath) {
  if (!app.isPackaged) return path.join(__dirname, relativePath);
  return path.join(process.resourcesPath, 'app.asar.unpacked', relativePath);
}

function spawnRuntimeNode(nodeExe, scriptPath, args, env, logPath, options = {}) {
  const logFd = fsSync.openSync(logPath, 'a');
  const child = spawn(nodeExe, [scriptPath, ...args], {
    detached: true,
    windowsHide: true,
    cwd: options.cwd,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, ...env },
  });
  child.once('error', error => {
    try {
      fsSync.appendFileSync(logPath, '\n[astra] Failed to start child process: ' + error.message + '\n');
    } catch {}
  });
  child.unref();
  fsSync.closeSync(logFd);
  return child;
}

async function copyMissing(source, destination) {
  if (!fsSync.existsSync(source)) return;
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const src = path.join(source, entry.name);
    const dst = path.join(destination, entry.name);
    if (fsSync.existsSync(dst)) {
      if (entry.isDirectory()) await copyMissing(src, dst);
      continue;
    }
    if (entry.isDirectory()) {
      await copyMissing(src, dst);
    } else if (entry.isFile()) {
      await fs.copyFile(src, dst, fsSync.constants.COPYFILE_EXCL).catch(error => {
        if (error.code !== 'EEXIST') throw error;
      });
    }
  }
}

async function ensureWorkspaceLink(homeDir, projectsDir) {
  const linkPath = path.join(homeDir, 'workspace');
  try {
    await fs.lstat(linkPath);
    return { path: linkPath, created: false };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await fs.symlink(projectsDir, linkPath, 'junction');
    return { path: linkPath, created: true };
  } catch (error) {
    if (error.code === 'EEXIST') return { path: linkPath, created: false };
    throw new Error('Cannot connect Astra projects to the default workspace: ' + error.message);
  }
}

async function syncWorkspaceRootLinks(projectsDir, roots) {
  const linksDir = path.join(projectsDir, 'roots');
  await fs.mkdir(linksDir, { recursive: true });
  const normalize = value => path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
  const projectKey = normalize(projectsDir);

  for (const root of roots) {
    const target = path.resolve(root);
    if (normalize(target) === projectKey) continue;

    const projectRelativeToTarget = path.relative(target, projectsDir);
    const targetContainsProjects = projectRelativeToTarget === '' ||
      (projectRelativeToTarget !== '..' &&
       !projectRelativeToTarget.startsWith('..' + path.sep) &&
       !path.isAbsolute(projectRelativeToTarget));
    if (targetContainsProjects) continue;

    const linkPath = path.join(linksDir, rootAlias(target));
    try {
      await fs.lstat(linkPath);
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await fs.symlink(target, linkPath, 'junction').catch(error => {
      if (error.code !== 'EEXIST') throw error;
    });
  }
}

async function ensureSecret(filePath) {
  try {
    return (await fs.readFile(filePath, 'utf8')).trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  await fs.writeFile(filePath, secret, { encoding: 'utf8', flag: 'wx' }).catch(error => {
    if (error.code !== 'EEXIST') throw error;
  });
  return (await fs.readFile(filePath, 'utf8')).trim();
}

async function ensureBrowserMcp(openHandsDir, runtimeRoot, nodeExe) {
  const userData = app.getPath('userData');
  const profileDir = path.join(userData, 'browser-profile');
  const downloadsDir = path.join(app.getPath('documents'), 'Astra Workstation', 'downloads');
  const logsDir = path.join(userData, 'logs');
  const tokenPath = path.join(userData, 'browser-mcp.token');
  const mcpConfigPath = path.join(openHandsDir, 'mcp.json');
  await Promise.all([
    fs.mkdir(profileDir, { recursive: true }),
    fs.mkdir(downloadsDir, { recursive: true }),
    fs.mkdir(logsDir, { recursive: true }),
  ]);

  const token = await ensureSecret(tokenPath);
  const mcpCli = path.join(app.getAppPath(), 'node_modules', '@playwright', 'mcp', 'cli.js');
  const proxyScript = getRuntimeScriptPath('src/browser-proxy.cjs');
  const nodeBinDir = path.dirname(nodeExe);
  const runtimeEnv = {
    PATH: path.join(runtimeRoot, 'bin') + path.delimiter + nodeBinDir + path.delimiter + process.env.PATH,
  };

  if (!fsSync.existsSync(mcpCli)) throw new Error('Playwright MCP is missing from the Astra installation. Reinstall Astra using the latest installer.');
  if (!fsSync.existsSync(proxyScript)) throw new Error('Astra browser gateway is missing from the installation.');

  if (!await isPortOpen(BROWSER_MCP_UPSTREAM_PORT)) {
    sendStatus('Запускаю видимый Microsoft Edge и подключаю Playwright…');
    spawnRuntimeNode(nodeExe, mcpCli, [
      '--host', '127.0.0.1',
      '--port', String(BROWSER_MCP_UPSTREAM_PORT),
      '--browser', 'msedge',
      '--user-data-dir', profileDir,
      '--output-dir', downloadsDir,
      '--shared-browser-context',
      '--caps', 'vision,pdf',
    ], { ...runtimeEnv, PLAYWRIGHT_MCP_PING_TIMEOUT_MS: '0' }, path.join(logsDir, 'browser-mcp.log'));
  }
  await waitForPort(BROWSER_MCP_UPSTREAM_PORT);

  if (!await isPortOpen(BROWSER_MCP_PORT)) {
    spawnRuntimeNode(nodeExe, proxyScript, [], {
      ...runtimeEnv,
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
    if (error.code !== 'ENOENT') throw new Error('Cannot read MCP configuration: ' + error.message);
  }
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.astra_browser = {
    transport: 'http',
    url: browserMcpUrl(BROWSER_MCP_PORT),
    headers: { Authorization: 'Bearer ' + token },
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
    process.env.SystemRoot || 'C:\\Windows',
    process.env.ProgramFiles || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    process.env.ProgramData || 'C:\\ProgramData',
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

function tailLog(logPath, limit = 6000) {
  try {
    return fsSync.readFileSync(logPath, 'utf8').slice(-limit).trim();
  } catch {
    return '';
  }
}

async function run(command, args, options = {}) {
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: options.cwd,
        env: options.env || process.env,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-100000); });
      child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-100000); });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(command + ' timed out'));
      }, options.timeout ?? 30000);
      child.once('error', error => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', code => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error((stderr || stdout || command + ' exited with code ' + code).trim()));
        else resolve({ stdout, stderr });
      });
    });
  } catch (error) {
    throw new Error(error.message || String(error));
  }
}

async function prepareWorkspace() {
  const homeDir = app.getPath('home');
  const projectsDir = path.join(app.getPath('documents'), 'Astra Workstation', 'projects');
  const starterDir = path.join(projectsDir, 'AstraGameDevStarter');
  const userData = app.getPath('userData');
  const legacyStateDir = path.join(userData, 'openhands');
  const openHandsPaths = getOpenHandsPaths(homeDir);
  const logsDir = path.join(userData, 'logs');

  await Promise.all([
    fs.mkdir(starterDir, { recursive: true }),
    fs.mkdir(openHandsPaths.openHandsDir, { recursive: true }),
    fs.mkdir(openHandsPaths.stateDir, { recursive: true }),
    fs.mkdir(logsDir, { recursive: true }),
  ]);

  const migrationMarker = path.join(openHandsPaths.openHandsDir, '.astra-migrated-from-0.2.0');
  if (!fsSync.existsSync(migrationMarker) &&
      path.resolve(legacyStateDir).toLowerCase() !== path.resolve(openHandsPaths.openHandsDir).toLowerCase()) {
    sendStatus('Переношу сохранённые данные Astra 0.2.0 без удаления старой копии…');
    await copyMissing(legacyStateDir, openHandsPaths.openHandsDir);
    await fs.writeFile(migrationMarker, new Date().toISOString(), 'utf8');
  }

  const starterSource = app.isPackaged
    ? path.join(process.resourcesPath, 'starter')
    : path.join(__dirname, '..', 'assets', 'starter');
  await copyMissing(starterSource, starterDir);

  const roots = await loadWorkspaceRoots(projectsDir);
  await syncWorkspaceRootLinks(projectsDir, roots);
  const workspaceLink = await ensureWorkspaceLink(homeDir, projectsDir);
  return { homeDir, projectsDir, starterDir, openHandsDir: openHandsPaths.openHandsDir, stateDir: openHandsPaths.stateDir, logsDir, roots, workspaceLink };
}

async function verifyBundledRuntime(runtimeRoot) {
  const nodeExe = path.join(runtimeRoot, 'node', 'node.exe');
  const npmCmd = path.join(runtimeRoot, 'node', 'npm.cmd');
  const npxCmd = path.join(runtimeRoot, 'node', 'npx.cmd');
  const npmCli = path.join(runtimeRoot, 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const uvExe = path.join(runtimeRoot, 'bin', 'uv.exe');
  const uvxExe = path.join(runtimeRoot, 'bin', 'uvx.exe');
  for (const file of [nodeExe, npmCmd, npxCmd, npmCli, uvExe, uvxExe]) {
    if (!fsSync.existsSync(file)) throw new Error('Не найден встроенный runtime-файл: ' + file + '. Переустанови Astra 0.3.0.');
  }
  const [node, uv, uvx] = await Promise.all([
    run(nodeExe, ['--version']),
    run(uvExe, ['--version']),
    run(uvxExe, ['--version']),
  ]);
  if (node.stdout.trim() !== 'v24.22.1') throw new Error('Неверная версия встроенного Node.js: ' + node.stdout.trim());
  if (!uv.stdout.includes('0.13.7') || !uvx.stdout.includes('0.13.7')) throw new Error('Версия встроенного uv не совпадает с ожидаемой 0.13.7.');
  return { nodeExe, uvExe, uvxExe };
}

async function waitForCanvas(child, logPath, timeoutMs = 900000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'Backend запускается и загружает Python-компоненты';
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      const output = tailLog(logPath);
      throw new Error('Agent Canvas завершился с кодом ' + child.exitCode + '.' + (output ? '\n\nПоследние строки журнала:\n' + output : ''));
    }
    try {
      const response = await fetch(BASE_URL + '/server_info', { signal: AbortSignal.timeout(5000) });
      if (response.ok) return;
      lastError = 'HTTP ' + response.status;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  const output = tailLog(logPath);
  throw new Error('Agent Canvas не стал доступен за 15 минут: ' + lastError + (output ? '\n\nПоследние строки журнала:\n' + output : ''));
}

async function startRuntime() {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    const paths = await prepareWorkspace();
    const runtimeRoot = getRuntimeRoot({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      projectRoot: path.join(__dirname, '..'),
    });
    const binaries = await verifyBundledRuntime(runtimeRoot);

    sendStatus('Запускаю браузер с постоянным профилем…');
    await ensureBrowserMcp(paths.openHandsDir, runtimeRoot, binaries.nodeExe);

    let ready = false;
    try {
      const response = await fetch(BASE_URL + '/server_info', { signal: AbortSignal.timeout(3000) });
      ready = response.ok;
    } catch {
      ready = false;
    }

    if (!ready && await isPortOpen(HOST_PORT)) {
      throw new Error('Порт ' + HOST_PORT + ' уже занят другим приложением. Закрой его и повтори запуск.');
    }

    if (!ready) {
      const cliPath = getAgentCanvasCliPath({
        isPackaged: app.isPackaged,
        appPath: app.getAppPath(),
        projectRoot: path.join(__dirname, '..'),
      });
      if (!fsSync.existsSync(cliPath)) throw new Error('Agent Canvas не найден в составе Astra. Переустанови Astra 0.3.0.');

      const secret = await ensureSecret(path.join(paths.openHandsDir, 'astra-secret-key'));
      const runtimeEnv = buildNativeRuntimeEnv({
        baseEnv: process.env,
        homeDir: paths.homeDir,
        stateDir: paths.stateDir,
        runtimeRoot,
      });
      runtimeEnv.OH_SECRET_KEY = secret;
      runtimeEnv.PORT = String(HOST_PORT);
      runtimeEnv.UV_PYTHON = '>=3.12,<3.15';
      runtimeEnv.PYTHONUTF8 = '1';

      sendStatus('Запускаю Agent Canvas напрямую в Windows — Docker и WSL не нужны…');
      const agentLogPath = path.join(paths.logsDir, 'agent-canvas.log');
      const child = spawnRuntimeNode(binaries.nodeExe, cliPath, [
        '--host', '127.0.0.1',
        '--port', String(HOST_PORT),
      ], runtimeEnv, agentLogPath, { cwd: paths.projectsDir });
      child.once('error', error => sendStatus('Ошибка запуска Agent Canvas: ' + error.message, 'error'));
      await waitForCanvas(child, agentLogPath);
    }

    sendStatus('Astra готова. Открываю рабочее пространство.', 'success');
    return { url: BASE_URL, starterDir: paths.starterDir, workspaceLink: paths.workspaceLink };
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
  if (mainWindow && !mainWindow.isDestroyed()) await mainWindow.loadURL(result.url);
  return { ok: true, starterDir: result.starterDir, workspaceLink: result.workspaceLink };
});

ipcMain.handle('astra:open-project-folder', async () => {
  const folder = path.join(app.getPath('documents'), 'Astra Workstation', 'projects');
  await fs.mkdir(folder, { recursive: true });
  await shell.openPath(folder);
  return folder;
});

ipcMain.handle('astra:open-logs-folder', async () => {
  const folder = path.join(app.getPath('userData'), 'logs');
  await fs.mkdir(folder, { recursive: true });
  await shell.openPath(folder);
  return folder;
});

ipcMain.handle('astra:add-workspace-root', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths?.[0]) return { cancelled: true };
  const selected = await fs.realpath(result.filePaths[0]);
  if (isProtectedWorkspaceRoot(selected)) {
    throw new Error('Эту папку нельзя добавить: выбери конкретную рабочую папку, а не системный каталог или хранилище учётных данных.');
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

  const projectsDir = path.join(app.getPath('documents'), 'Astra Workstation', 'projects');
  await syncWorkspaceRootLinks(projectsDir, [projectsDir, ...roots]);
  return { cancelled: false, root: selected, restartRequired: false };
});

ipcMain.handle('astra:list-workspace-roots', async () => {
  const projectsDir = path.join(app.getPath('documents'), 'Astra Workstation', 'projects');
  return loadWorkspaceRoots(projectsDir);
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

// Agent Canvas and browser services are detached so long-running tasks survive
// closing the Astra launcher. Restarting Astra reuses their loopback services.
