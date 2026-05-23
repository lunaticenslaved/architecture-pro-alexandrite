const express = require('express');

const app = express();
const PORT = 3000;

// GET метод, возвращающий "hello world"
app.get('/', (req, res) => {
  res.send('hello world, service-b!');
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});