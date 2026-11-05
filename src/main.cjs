'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { createComposeConfig } = require('./compose-config.cjs');

const execFileAsync = promisify(execFile);
const APP_NAME = 'Astra Workstation';
const IMAGE = 'ghcr.io/openhands/agent-canvas:1.35.0';
const HOST_PORT = 18000;
const BASE_URL = `http://127.0.0.1:${HOST_PORT}`;
const DOCKER_DESKTOP_EXE = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
let mainWindow;
let startPromise;

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
  const compose = createComposeConfig({ stateDir, projectsDir, image: IMAGE, hostPort: HOST_PORT });
  await fs.writeFile(composeFile, compose, 'utf8');

  return { projectsDir, starterDir, stateDir, composeFile };
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
    sendStatus('Проверяю Docker Desktop…');
    await waitForDocker();
    const paths = await prepareWorkspace();

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
