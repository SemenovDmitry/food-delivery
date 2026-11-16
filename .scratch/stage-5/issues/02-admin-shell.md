# 02: Каркас админки — proxy.ts, живые гарды, layout с навигацией по роли

**What to build:** `src/proxy.ts` (**создать** — факта нет, §5.9 описывал задел): matcher `/admin/:path*`, fast-fail проверка cookieCache-сессии (роль admin|manager → пропустить, иначе redirect `/login`); синтаксис proxy/middleware сверить с доками v16 в `node_modules/next/dist/docs/` (§5.1). Живой гвард в `lib/session.ts`: `getAdminSession` усиливается — после `getSession` свежий `SELECT role, banned_at, deleted_at FROM "user"` по `session.userId` (cookieCache не доверяем, Q14); роль вне admin|manager / бан / архив → `signOut` + redirect `/login` (тост «Роль изменена» / «Аккаунт заблокирован» / «Аккаунт удалён»). Хелпер для admin-only страниц (products|categories|promotions|users|settings — admin строго): manager → тихий `redirect('/admin/orders')`. `(admin)` layout: контейнер + nav-landmark, пункты по роли (manager: только «Заказы»; admin: Заказы, Товары, Категории, Акции, Пользователи, Настройки), активный пункт. `/admin` → redirect `/admin/orders` (без дашборда, Q2).

**Blocked by:** 01

**Status:** resolved

- [x] `src/proxy.ts` по докам v16 — fast-fail redirect (named export `proxy` + `config.matcher`; cookie-проверка по суффиксу имени — `.session_token`/`.session_data`, конфигурация-независимо; живая авторизация осталась в layout, доки: proxy — не место для авторизации)
- [x] Живая проверка (role/banned_at/deleted_at) + signOut-редирект в `lib/session.ts` (`enforceNotBlocked` / `requireAdmin` / `requireAdminOnly`; нюанс: signOut мутирует cookie — из RSC только redirect, каждый guarded-запрос всё равно режется живой проверкой)
- [x] Admin-only хелпер (manager → `/admin/orders`) — route group `src/app/admin/(admin-only)/layout.tsx`
- [x] `(admin)` layout: nav по роли (`components/admin/admin-nav.tsx`, usePathname внутри Suspense — §5.30), активный пункт, landmarks
- [x] `/admin` → redirect `/admin/orders`
- [x] Бан режет мутации магазина: `enforceNotBlocked` в cart-actions, createOrder/cancelOrder/repeatOrder/applyPromoCode, страницы /orders и /checkout; баннер `?notice=` на /login (banned/deleted/role)
- [x] tsc зелёный; приёмка гвардов — тикет 11 (браузер)
