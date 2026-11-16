# steelcraft-tuning-api (china-cars-backend)

REST-бэкенд сайта автотюнинга на **Node.js + Express + Drizzle ORM + PostgreSQL**.
Разворачивается на Vercel отдельным проектом (Serverless Functions), фронтенд —
отдельным Next.js-проектом.

## Схема работы

```
Браузер (Next.js фронтенд)  --fetch-->  этот API (Express на Vercel)  --Drizzle-->  PostgreSQL (Neon/Supabase)
```

- Фронтенд **не** подключается к БД: `DATABASE_URL` задан только здесь.
- Фронтенд знает только `NEXT_PUBLIC_API_URL` (адрес этого API).
- Авторизация админки: `POST /api/admin/login` -> JWT на 8 часов ->
  заголовок `Authorization: Bearer <token>` в последующих запросах.

## Эндпоинты

| Метод | Путь                     | Доступ | Описание |
|-------|--------------------------|--------|----------|
| GET   | `/api/health`            | публично | статус: `{ ok, db: "configured"|"demo", admin, adminMissing[] }` |
| GET   | `/api/products`          | публично | каталог (только активные), `demo: true` если БД не подключена |
| GET   | `/api/products/:slug`    | публично | одна позиция |
| POST  | `/api/leads?source=...`  | публично | заявка с формы; 201 / 422 |
| POST  | `/api/admin/login`       | публично | `{username, password}` -> `{token}` |
| GET   | `/api/admin/me`          | токен  | проверка сессии |
| GET   | `/api/admin/leads`       | токен  | все заявки, свежие сверху |
| DELETE| `/api/admin/leads/:id`   | токен  | удалить заявку |
| GET   | `/api/admin/products`    | токен  | все товары, включая неактивные |
| POST  | `/api/admin/products`    | токен  | создать товар |
| PUT   | `/api/admin/products/:id`| токен  | обновить товар |
| DELETE| `/api/admin/products/:id`| токен  | удалить товар |

## Переменные окружения (Vercel -> Settings -> Environment Variables)

| Переменная | Зачем |
|------------|-------|
| `DATABASE_URL` | строка подключения Neon/Supabase (**pooled**, хост с `-pooler`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | логин/пароль админки |
| `ADMIN_JWT_SECRET` | случайная строка 32+ символа (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | домены фронта через запятую, напр. `https://ваш-фронт.vercel.app`. Не задано = разрешить всем |

### Два (или больше) фронтенда — CORS

Разрешить запросы сразу с двух хостингов фронта — просто перечислите оба домена
в одной переменной `CORS_ORIGIN` через запятую (без пробелов, без `/` на конце):

```bash
CORS_ORIGIN=https://granfort.ru,https://granfort-vercel.vercel.app
```

- Сервер отвечает `Access-Control-Allow-Origin: <домен запроса>` только тем,
  кто есть в списке; чужой домен получает запрос без CORS-заголовков (браузер его блокирует).
- Локальную разработку добавьте туда же: `...,http://localhost:3000`.
- Изменили переменную на Vercel — сделайте Redeploy, иначе старое значение останется в сборке.
- Проверить можно curl'ом — домен из списка вернёт заголовок, чужой — нет:
  ```bash
  curl -s -i https://<бэк>/api/health -H "Origin: https://granfort.ru" | grep -i allow-origin
  ```

## Деплой на Vercel

1. Импортировать репозиторий как новый проект (Framework Preset определится сам; если спросит — Root Directory оставить `/`).
2. Добавить переменные окружения из таблицы выше (Production + Preview).
3. Подключить БД: Storage -> Marketplace -> Neon/Supabase, либо вставить готовый `DATABASE_URL` вручную.
4. Миграции выполняются локально один раз (у Vercel нет predeploy-хука):
   ```bash
   cp .env.example .env        # вписать реальный DATABASE_URL
   npm install
   npm run db:migrate          # создаст таблицы products, leads
   npm run db:seed             # (опционально) демо-товары
   ```
5. Проверка: открыть `https://<проект>.vercel.app/api/health` — должно быть `{"ok":true,"db":"configured",...}`.

Предупреждение в логе сборки
`WARNING! Internal rewrites in backend framework projects...` —
не ошибка: это информационное сообщение о том, что запросы маршрутизируются
по rewrite из `vercel.json` на `/api/index` (Express). Сборка проходит нормально.

## Деплой на Netlify (второй хостинг)

Тот же Express работает на Netlify Functions: `netlify.toml` +
`netlify/functions/api.ts` (адаптер `serverless-http` уже в зависимостях).

1. В Netlify: Add new site -> Import an existing project; **Base directory = server**
   (если репозиторий общий) или подключить репозиторий бэкенда целиком.
   Собирает Netlify сам: TS-функции бандлятся esbuild'ом, отдельная сборка не нужна.
2. Задать те же Environment Variables, что и на Vercel, и **обязательно
   те же значения**: одинаковые `DATABASE_URL`, `ADMIN_JWT_SECRET`,
   `ADMIN_USERNAME`/`ADMIN_PASSWORD` и `CORS_ORIGIN`. Общий `DATABASE_URL`
   держит данные одинаковыми, общий `ADMIN_JWT_SECRET` делает токен,
   выпущенный Vercel'ом, действительным и на Netlify (и наоборот).
3. Проверка: `https://<проект>.netlify.app/api/health` — тот же JSON,
   что и на Vercel (redirect `/api/*` -> function уже настроен в `netlify.toml`).

Зачем два хостинга: фронтенд (`NEXT_PUBLIC_API_URLS`, см. README фронтенда)
шлёт GET-запросы на оба адреса сразу и берёт первый успешный ответ —
если Vercel тормозит или лежит, всё продолжает отвечать Netlify (и наоборот).
Записи (POST/PUT/DELETE) идут на первый бэкенд с фолбэком на второй,
чтобы заявки и товары не создавались дважды.

## Пустая база после привязки Neon?

Если `DATABASE_URL` уже задан, но миграции ещё не выполнялись, `/api/products`
вернёт «Таблицы БД не созданы — выполните миграции...». Лечится один раз локально:

```bash
cp .env.example .env       # вписать DATABASE_URL от Neon
npm install
npm run db:migrate         # создаст таблицы products и leads
npm run db:seed            # наполнит каталог 6 демо-товарами
```

Проверка: `curl https://<бэк>.vercel.app/api/products` →
`{"demo":false,"products":[...]}` (пустой `products: []` — это не ошибка,
просто без seed). Редеплой после миграций не нужен.

Нюанс строк подключения Neon: для **приложения** (Variables на Vercel)
используйте pooled-строку (хост содержит `-pooler`), для **миграций локально**
надёжнее прямая (Direct connection, без `-pooler`).

Альтернатива миграциям: `npx drizzle-kit push --force` создаёт таблицы
напрямую из `src/db/schema.ts` (флаг `--force` нужен только в
неинтерактивных средах — CI/скрипты).

## Что было исправлено

### 1. Ошибка сборки TS2352

Было в `src/routes/admin.ts` (~строка 65):
```ts
(req as Request & { adminUsername?: string }).adminUsername = username;
// error TS2352: ... missing ... cache, credentials, destination, integrity, and 14 more
```
`Request` без импорта из express превращался в глобальный тип Fetch API,
поэтому приведение типов было некорректным. Стало:
- `src/types/express.d.ts` — аугментация `Express.Request` полем `adminUsername`;
- в коде просто `req.adminUsername = username` без кастов.

### 2. Ошибка рантайма FUNCTION_INVOCATION_FAILED (500 после деплоя)

Сборка проходила, но функция падала при холодном старте. Причины, которые
устранены в этой версии:

- **`postgres` v4 — ESM-only** (в `package.json` нет CJS-сборки). Скомпилированный
  tsc/esbuild код — CommonJS, и `require("postgres")` на рантаймах без поддержки
  require(esm) (Node 20.x и старше) ронял функцию целиком. Заменено на
  **`postgres` v3.4.x** — у него в exports есть `default → cjs/src/index.js`,
  чистая CJS-сборка. API использования не изменился (`prepare: false`, `max`).
- **`jose` заменён на встроенный `node:crypto`** — HS256-JWT считается вручную
  (см. `src/lib/token.ts`). Ноль зависимостей, быстрее холодный старт, меньше
  точек отказа.
- **`engines` зафиксирован на `22.x`** — без `"node": ">=20"` Vercel молча
  поднимает рантайм до самой свежей major-версии при каждом релизе.
- **Защита от `listen()` в serverless**: в `src/index.ts` порт слушается только
  вне Vercel (`process.env.VERCEL`). `listen()` внутри функции — самая частая
  причина FUNCTION_INVOCATION_FAILED.
- Ошибки обработчика логируются в консоль — их видно в
  **Vercel Dashboard → Deployments → Runtime Logs**.

Если после деплоя снова увидите 500: откройте Deployments → последний деплой →
вкладка **Runtime Logs**, повторите запрос и найдите стектрейс (по нему сразу
видна причина; id вида `arn1::...` из тела ошибки можно поискать в логах).

## Локальная разработка

```bash
npm install
cp .env.example .env   # заполнить (DATABASE_URL можно не задавать — будет демо-режим)
npm run dev            # http://localhost:3001/api/health
```

### Если админка пишет «Админка не настроена … в Variables» при локальном запуске

Раньше сервер не читал .env вообще (dotenv подключался только в seed-скрипте
и drizzle.config.ts), поэтому ADMIN_* были пусты при любом заполненном .env.
Теперь .env загружается автоматически при старте API (см. `src/env.ts`,
подключён первым импортом в `src/app.ts`).

Где может лежать .env — работают оба варианта:

- `server/.env` — рядом с package.json (стандарт);
- `.env` в корне репо — рядом с фронтендом.

Проверка после `npm run dev` (смотрите и лог в консоли — при старте печатается
`[env] Админка настроена …` или список недостающих переменных):

```bash
curl http://localhost:3001/api/health
# {"admin":true,"adminMissing":[], ...}   — всё на месте, логин сработает
# {"admin":false,"adminMissing":["ADMIN_PASSWORD"], ...} — этих имён нет в .env
```

Частые причины ошибки:

1. Файл называется `.env.txt` (Windows скрывает расширения) — переименуйте в `.env`.
2. Имена переменных не совпадают: нужны именно `ADMIN_USERNAME` (не
   `ADMIN_LOGIN`) и `ADMIN_JWT_SECRET` (не `JWT_SECRET`).
3. Переменные заданы только в терминале (export/set), а запускаете в другом
   окне — проще прописать их в .env.

## Проверка CORS

```bash
# preflight:
curl -i -X OPTIONS https://<api>.vercel.app/api/products \
  -H "Origin: https://ваш-фронт.vercel.app" \
  -H "Access-Control-Request-Method: GET"
# в ответе должен быть: Access-Control-Allow-Origin: https://ваш-фронт.vercel.app
```
