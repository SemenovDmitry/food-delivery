# 06: Слайс 3 — стори shop-хвоста + root + admin-лёгкие (8 компонентов / 14 сторей)

**What to build:** (матрица Q6 спеки слайса 3) — **Shop/ProductDetails** (2): Товар (фикстура margherita, imageSrc=null → emoji-фолбэк) · Сет (shawarmaForTwo — рендер setComponents); cart-мок уже есть. — **Shop/Header** (3): Гость / Авторизован (бейдж Σ3, dropdown закрыт) / Загрузка сессии (pulse-скелетон) — все через `__setSession` мока auth-client (тикет 05); `cartSlot` — статичный ReactNode, визуальный эквивалент бейджа (серверный CartBadge в iframe невоспроизводим — спека). — **Shop/RepeatOrderButton** (1): Default; успех/ошибка — тосты, покрыты e2e. — **Theme/ThemeToggle** (1): обе иконки рендерятся, видимость через `dark:`; toolbar light/dark показывает обе темы. — **Admin/AdminNav** (2): Admin (8 ссылок, активный пункт — per-story декоратор, перекрывающий PathnameContext на `/admin/orders`; паттерн провайдера уже в preview) · Manager (2 ссылки: Заказы, Чаты). — **Admin/PerPageSelect** (1): base='/admin/orders', perPage=10. — **Admin/SortableList** (1): generic-фикстуры ×3; DnD-интеракции не эмулируем. — **Admin/OrderStatusCell** (3): Готовится (preparing/delivery/paid — select с легальными переходами) · Неоплаченный онлайн (online+pending — disabled + подсказка) · Доставлен (delivered — терминальный, без select); orders-мок (updateOrderStatus) уже есть. Фикстуры shop — из `fixtures.ts`; админ-строки — локально в стори-файлах, типы через `import type` (браузерная безопасность — прецедент fixtures.ts).

**Blocked by:** 05 (этап 13, слайс 3)

**Status:** resolved

- [x] 8 стори-файлов, 14 сторей; namespace Shop/…, Admin/…, Theme/…
- [x] Header через `__setSession` (3 состояния), cartSlot статичный
- [x] AdminNav-активность через PathnameContext-декоратор
- [x] `pnpm build-storybook` зелёный

## Comments

- 2026-11-20 (аудит слайса): **находка link-name (serious, 6 прогонов) — пробел ФИКСТУРЫ, не прод-кода**: cartSlot-эквивалент взял только видимую точку бейджа, а продовый CartBadge всегда рендерит + `<span class='sr-only'>В корзине N товаров</span>` (и в fallback скелетона) — ссылка корзины в проде именована. Фикс — cartSlot-фикстура стала точным зеркалом прод-вывода (точка + sr-only), реверифицировано повторным аудитом.
- 2026-11-20 (реализация): сторя ProductDetails «Set» переименована в `SetProduct` — biome `noShadowRestrictedNames` (глобальный `Set`).
