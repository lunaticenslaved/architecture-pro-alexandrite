# Используем официальный образ Node.js версии 20 (LTS)
FROM node:20-alpine AS deps

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы с зависимостями
COPY package*.json ./

# Устанавливаем зависимости (только production для меньшего размера)
RUN npm ci --only=production

# Второй этап для финального образа
FROM node:20-alpine

# Устанавливаем переменную окружения для production
ENV NODE_ENV=production

WORKDIR /app

# Копируем установленные зависимости из первого этапа
COPY --from=deps /app/node_modules ./node_modules

# Копируем исходный код приложения
COPY . .

# Создаем пользователя без прав root для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Переключаемся на непривилегированного пользователя
USER nodejs

# Открываем порт, который использует приложение (например, 3000)
EXPOSE 3000

# Команда для запуска сервера
CMD ["node", "index.js"]