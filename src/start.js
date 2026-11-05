'use strict';

const status = document.getElementById('status');
const detail = document.getElementById('detail');
const errorBox = document.getElementById('error');
const startButton = document.getElementById('start');
const rootsList = document.getElementById('roots-list');

async function refreshRoots() {
  try {
    const roots = await window.astra.listWorkspaceRoots();
    rootsList.textContent = roots.length ? roots.join('\n') : 'Пока подключена только папка проектов Astra.';
  } catch (error) {
    rootsList.textContent = error?.message || String(error);
  }
}

refreshRoots();

window.astra.onStatus(({ message, kind }) => {
  status.textContent = message;
  if (kind === 'success') detail.textContent = 'Открываю Agent Canvas…';
});

startButton.addEventListener('click', async () => {
  errorBox.hidden = true;
  startButton.disabled = true;
  status.textContent = 'Подготовка среды Windows…';
  detail.textContent = 'Проверка Node.js и uv, перенос настроек и запуск локального backend.';
  try {
    await window.astra.start();
  } catch (error) {
    errorBox.textContent = error?.message || String(error);
    errorBox.hidden = false;
    status.textContent = 'Не удалось запустить Agent Canvas';
    detail.textContent = 'Проверь подключение к интернету и журналы запуска. Проекты и сохранённое состояние не удаляются.';
    startButton.textContent = 'Повторить запуск';
    startButton.disabled = false;
  }
});

document.getElementById('projects').addEventListener('click', () => {
  window.astra.openProjectFolder();
});

document.getElementById('logs').addEventListener('click', () => {
  window.astra.openLogsFolder();
});

document.getElementById('add-folder').addEventListener('click', async () => {
  try {
    const result = await window.astra.addWorkspaceRoot();
    if (result.cancelled) return;
    await refreshRoots();
    status.textContent = 'Папка добавлена';
    detail.textContent = 'Ссылка на папку доступна в projects/roots и сразу видна нативному агенту.';
  } catch (error) {
    errorBox.textContent = error?.message || String(error);
    errorBox.hidden = false;
  }
});
