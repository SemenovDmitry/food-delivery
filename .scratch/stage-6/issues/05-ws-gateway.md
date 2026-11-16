# 05: ws-gateway — workspace-пакет, upgrade-аутентификация, комнаты, релей

**What to build:** Отдельный WS-шлюз (§5.22 — в Route Handlers WS не работают): пакет `ws-gateway/` в корне, `packages:` в pnpm-workspace.yaml (сейчас поля нет), deps `ws` + `postgres` + zod, TS→tsc (свой tsconfig, module NodeNext, strict), свой zod-env fail-fast: `DATABASE_URL` (фолбэк localhost:5560 как db/index.ts), `NEXT_INTERNAL_URL` (dev `http://localhost:3000`), `PORT=3001`, `INTERNAL_API_SECRET`. Upgrade: проверка Origin (только свои хосты) + аутентификация — cookies апгрейд-запроса пересылаются в `NEXT_INTERNAL_URL/api/auth/get-session` (куки не изолируются по порту, §5.22): оператор admin|manager → identity operator; иначе кука `chat_token` → guest; иначе **отказ upgrade** (без идентичности — «Готово, когда»). Комнаты в памяти: соединение→identity, комнаты по threadId + комната `operators`; `subscribe{threadId}` — валидация через internal (action join) один раз на соединение, результат кешируется; `subscribe-operators` — по роли с upgrade. Релей: `send{threadId,text,tempId}` → POST internal → `ack{tempId,message}` | `error{tempId?,code}`; `read` → internal read. Фанаут: LISTEN канала `chat` (postgres-js, отдельное соединение) → парс payload → `message{threadId,phone,message}` broadcast в комнату треда + комнату operators (телефон уже в payload — шлюз без БД-чтений). ping/pong 30 с — мёртвые соединения сносятся. Минимальный дубликат типов протокола с комментом «контракт — lib/ws-protocol.ts» (граница, не библиотека, Q14). Логи — структурные строки в stdout (pino — этап 11).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Workspace-пакет: pnpm-workspace `packages:`, lockfile перегенерирован, `tsc -p ws-gateway` чист
- [ ] env fail-fast (zod): все 4 переменные, понятная ошибка при отсутствии
- [ ] upgrade: Origin + сессия (get-session) / кука chat_token / отказ
- [ ] Комнаты: треды + operators; subscribe через internal — один раз на соединение
- [ ] Релей send/read → internal → ack/error; LISTEN `chat` → broadcast в обе аудитории
- [ ] ping/pong 30 с; дубликат протокола с указателем на контракт
- [ ] Скрипт `pnpm dev:gateway` поднимает шлюз на :3001 (node --watch + tsx-лоадер, без новых зависимостей)
- [ ] Ручная проверка: WS-клиент-скрипт подключается, subscribe проходит, сообщение из internal-NOTIFY приходит в комнату
