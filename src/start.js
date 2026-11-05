'use strict';

const status = document.getElementById('status');
const detail = document.getElementById('detail');
const errorBox = document.getElementById('error');
const startButton = document.getElementById('start');

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
