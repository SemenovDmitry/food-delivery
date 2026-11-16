# 09: /admin/users — таблица, поиск, пагинация, бан/архив

**What to build:** Query `getUsersList({ q, page, perPage })` — uncached: `WHERE deleted_at IS NULL`, `?q=` ilike по `email`/`phoneNumber`, left join count заказов (Σзаказов), пагинация limit/offset + count. Страница `/admin/users` (admin-only): таблица имя / телефон / email / роль (**display-only** — смены роли НЕТ, Q12/Q18: сотрудники только сидером) / регистрация / Σзаказов / действия: «Забанить»/«Разбанить» (`banned_at`), «Архивировать» (`deleted_at`, Dialog с именем/телефоном; ban и архив — независимые флаги, Q24). Actions: `banUser`/`unbanUser`/`archiveUser` (admin-guard, **self-guard** — нельзя себя, Q15). Гарды входа в `lib/actions/auth.ts`: `sendLoginOtp`/`sendRegisterOtp` — проверка banned_at/deleted_at ДО `sendPhoneNumberOTP` («Аккаунт заблокирован» / «Аккаунт удалён», SMS не уходит). Забаненный при живой сессии теряет доступ на следующем guarded-запросе (live-проверка тикета 02 → signOut). Restore-UI нет (Q24).

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Query: поиск + Σзаказов + пагинация, фильтр archived
- [ ] Страница: таблица + ban/unban/archive с self-guard
- [ ] Гарды входа до OTP (SMS не уходит забаненным)
- [ ] Приёмка: ban юзера с живой сессией → его следующий guarded-запрос = signOut + тост; archive скрывает из списка, заказы остаются атрибутированными; архивированный не может войти
