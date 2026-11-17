# 04: POST /api/chat/internal — служебный релей-приёмник с живой валидацией

**What to build:** Служебный Route Handler для WS-шлюза (§5.22, 6-й роут §8). Гард `x-internal-secret` === `INTERNAL_API_SECRET`: переменная не задана → fail-fast на импорте модуля (первый обязательный env до этапа 11), неверный секрет → 403. Тело — zod discriminated union (Q9): `{action:'send', identity, threadId, text}` / `{action:'read', identity, threadId, side}` / `{action:'join', identity, threadId}`. **Каждый send перевалидируется живым срезом БД** (гвард-стиль этапа 5, §5.32-стиль live-гардов): customer — тред принадлежит его `user_id`/`guest_token`; operator — свежий SELECT role/`banned_at`/`deleted_at` (забаненный/архивный отсекается на следующем же сообщении, cookieCache не доверяем); гость идентичен только токеном треда. send → вставка ядра (02) + NOTIFY → `{ok:true, message}`; read → UPDATE нужного `*_last_read_at` → ok; join (валидация подписки шлюзом) → ок только владельцу/оператору → ok|forbidden. Ошибки → `{ok:false, code: validation|forbidden|banned}`. Никакого кеширования, no-store.

**Blocked by:** 02

**Status:** resolved

- [x] Гард секрета: нет env → fail-fast на старте; неверный → 403
- [x] Discriminated union send|read|join + zod-схемы identity
- [x] send: живая перевалидация (владение треда / роль+бан+архив) → INSERT+NOTIFY → {message}
- [x] read: UPDATE customer/operator last_read_at по side; join: ок владельцу и оператору
- [x] curl-негативы: без секрета 403; guest-чужой тред → forbidden; текст >2000 → validation
