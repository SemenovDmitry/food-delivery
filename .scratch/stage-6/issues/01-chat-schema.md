# 01: Миграция чата — chat_threads / chat_messages + zod-схема текста

**What to build:** Фундамент данных чата: миграция `0005_*` через drizzle-kit generate (SQL в git, §5.12). `chat_threads` — uuid pk defaultRandom; `user_id` text FK → user.id onDelete cascade, nullable, unique (один тред на юзера; множественные NULL в PG уникальность не ломают); `guest_token` uuid nullable + unique (идентичность гостя из куки `chat_token`); `customer_last_read_at` / `operator_last_read_at` timestamp nullable; createdAt/updatedAt по конвенции. `chat_messages` — id bigserial pk (порядок отображения = id; uuid не нужен — айдишники не попадают в URL); `thread_id` uuid FK → chat_threads.id cascade; `direction` text notNull по константе `CHAT_DIRECTIONS = ['customer','operator'] as const` (pgEnum в проекте не используется — конвенция schema.ts); `sender_id` text FK → user.id set null (гость-клиент даёт null, FK переживает удаление оператора); `text` text notNull (1..2000 — валидация zod-схемой, колонка БЕЗ CHECK); createdAt. Экспорт типов `$inferSelect`. Zod-схема текста в `lib/schemas/chat.ts`: trim → 1..2000 символов, сообщение об ошибке по-русски — единая истина для internal-роута и валидации релея.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Схема в `src/db/schema.ts` по конвенциям репо (uuid/text FK с комментом «better-auth использует text-идентификаторы», inline timestamps, unique через третий аргумент)
- [ ] `pnpm db:generate` → `drizzle/0005_*.sql` закоммичен, `pnpm db:migrate` накатывает чисто
- [ ] `CHAT_DIRECTIONS` + типы `ChatThread`/`ChatMessage`/`ChatDirection` экспортированы из схемы
- [ ] `lib/schemas/chat.ts`: схема текста (trim, 1..2000), переиспользуется сервером
- [ ] Миграция не ломает существующие таблицы; повторный `db:migrate` идемпотентен
