'use strict';

const status = document.getElementById('status');
const detail = document.getElementById('detail');
const errorBox = document.getElementById('error');
const startButton = document.getElementById('start');
const rootsList = document.getElementById('roots-list');

async function refreshRoots() {
  try {
    const roots = await window.astra.listWorkspaceRoots();
    rootsList.textContent = roots.length ? roots.join('\n') : 'Пока подключены только папки проектов Astra.';
  } catch (error) {
    rootsList.textContent = error?.message || String(error);
  }
}

refreshRoots();

window.astra.onStatus(({ message, kind }) => {
  status.textContent = message;
  if (kind === 'success') detail.textContent = 'Открываю интерфейс Agent Canvas…';
});

startButton.addEventListener('click', async () => {
  errorBox.hidden = true;
  startButton.disabled = true;
  status.textContent = 'Подготовка рабочей среды…';
  detail.textContent = 'Проверка Docker, загрузка образа и запуск сервера.';
  try {
    await window.astra.start();
  } catch (error) {
    errorBox.textContent = error?.message || String(error);
    errorBox.hidden = false;
    status.textContent = 'Не удалось запустить песочницу';
    detail.textContent = 'Исправь указанную проблему и нажми «Повторить запуск». Проекты и сохранённое состояние не удаляются.';
    startButton.textContent = 'Повторить запуск';
    startButton.disabled = false;
  }
});

document.getElementById('projects').addEventListener('click', () => {
  window.astra.openProjectFolder();
});


document.getElementById('add-folder').addEventListener('click', async () => {
  try {
    const result = await window.astra.addWorkspaceRoot();
    if (result.cancelled) return;
    await refreshRoots();
    status.textContent = 'Папка добавлена';
    detail.textContent = 'Новая папка будет доступна агенту после следующего запуска песочницы.';
  } catch (error) {
    errorBox.textContent = error?.message || String(error);
    errorBox.hidden = false;
  }
});
