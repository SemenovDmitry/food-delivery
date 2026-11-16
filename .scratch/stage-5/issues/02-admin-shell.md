# 02: Каркас админки — proxy.ts, живые гарды, layout с навигацией по роли

**What to build:** `src/proxy.ts` (**создать** — факта нет, §5.9 описывал задел): matcher `/admin/:path*`, fast-fail проверка cookieCache-сессии (роль admin|manager → пропустить, иначе redirect `/login`); синтаксис proxy/middleware сверить с доками v16 в `node_modules/next/dist/docs/` (§5.1). Живой гвард в `lib/session.ts`: `getAdminSession` усиливается — после `getSession` свежий `SELECT role, banned_at, deleted_at FROM "user"` по `session.userId` (cookieCache не доверяем, Q14); роль вне admin|manager / бан / архив → `signOut` + redirect `/login` (тост «Роль изменена» / «Аккаунт заблокирован» / «Аккаунт удалён»). Хелпер для admin-only страниц (products|categories|promotions|users|settings — admin строго): manager → тихий `redirect('/admin/orders')`. `(admin)` layout: контейнер + nav-landmark, пункты по роли (manager: только «Заказы»; admin: Заказы, Товары, Категории, Акции, Пользователи, Настройки), активный пункт. `/admin` → redirect `/admin/orders` (без дашборда, Q2).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `src/proxy.ts` по докам v16 — fast-fail redirect
- [ ] Живая проверка (role/banned_at/deleted_at) + signOut-редирект в `lib/session.ts`
- [ ] Admin-only хелпер (manager → `/admin/orders`)
- [ ] `(admin)` layout: нав по роли, активный пункт, landmarks
- [ ] `/admin` → redirect `/admin/orders`
- [ ] Приёмка: гость → `/login`; customer → `/login`; manager на `/admin/products` → `/admin/orders`; забаненный admin при живой сессии → signOut на следующем запросе
