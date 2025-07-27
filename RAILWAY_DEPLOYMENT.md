# Деплой на Railway (Монорепозиторий)

## Подготовка проекта

Проект готов к деплою на Railway. Выполнены следующие изменения:

1. ✅ Создан `railway.json` и `nixpacks.toml` для монорепо
2. ✅ Создан отдельный `backend/railway.json` и `backend/nixpacks.toml`
3. ✅ Добавлен скрипт `start:prod` в backend/package.json
4. ✅ Настроен порт по умолчанию (3000) в main.ts
5. ✅ CORS уже настроен с поддержкой переменных окружения

## Шаги деплоя

### 1. Подготовьте GitHub репозиторий
```bash
git add .
git commit -m "Prepare for Railway deployment with monorepo support"
git push origin main
```

### 2. Настройте Railway (Backend)

**ВАЖНО**: У вас монорепозиторий - backend и frontend в одном репо!

1. Зайдите на [railway.app](https://railway.app)
2. Войдите через GitHub
3. Нажмите "Deploy from GitHub repo"
4. Выберите ваш репозиторий
5. **В Root Directory укажите: `backend`** ⚠️
6. Railway автоматически найдет `backend/railway.json` и `backend/nixpacks.toml`

### 3. Добавьте PostgreSQL

1. В проекте Railway нажмите "+" → "Database" → "Add PostgreSQL"
2. Railway автоматически создаст переменные DATABASE_URL

### 4. Настройте переменные окружения

В разделе Variables добавьте:

```env
NODE_ENV=production
PORT=3000
DB_HOST=${PGHOST}
DB_PORT=${PGPORT}
DB_USERNAME=${PGUSER}
DB_PASSWORD=${PGPASSWORD}
DB_NAME=${PGDATABASE}
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### 5. Деплой фронтенда на Vercel

1. Зайдите на [vercel.com](https://vercel.com)
2. Импортируйте проект из GitHub
3. **Укажите Root Directory: `frontend`** ⚠️ (важно для монорепо!)
4. В переменных окружения добавьте:
```env
REACT_APP_API_URL=https://your-backend.railway.app
```

### Альтернатива: Фронтенд тоже на Railway

Если хотите деплоить фронтенд тоже на Railway:
1. Создайте второй проект в Railway
2. Подключите тот же GitHub репо
3. **Укажите Root Directory: `frontend`**
4. Railway соберет React приложение автоматически

### 6. Обновите CORS

После получения доменов обновите переменную в Railway:
```env
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-custom-domain.com
```

## Автоматический деплой

После настройки каждый push в main ветку будет автоматически деплоить проект.

## Проверка работы

1. Откройте ваш фронтенд домен
2. Создайте комнату
3. Поделитесь ссылкой с другом для проверки совместного редактирования

## Лимиты Railway

- $5 бесплатно в месяц
- После превышения сервис приостанавливается до следующего месяца
- PostgreSQL: 1GB диск, 100 часов в месяц

## Альтернативы

Если лимиты Railway не подходят:
- **Render**: Бесплатный backend + Supabase для БД
- **Vercel**: Фронтенд + Vercel Functions для простых API
- **Heroku**: С привязкой карты (без списаний при соблюдении лимитов)