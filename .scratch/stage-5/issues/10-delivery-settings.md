# 10: /admin/settings — форма доставки (рубли → копейки)

**What to build:** Страница `/admin/settings` (admin-only). Форма RHF+zod (`lib/schemas/settings.ts`): `delivery_fee`, `free_delivery_threshold` — input в **рублях** (step 0.01, min 0) → zod transform ×100 → копейки → upsert в `settings` (ключи `delivery_fee`/`free_delivery_threshold`). Шов этапа 1 цел: `getDeliverySettings()` продолжает читать те же ключи — callers не меняются. Превью в форме: «Доставка 199 ₽ · бесплатно от 1 000 ₽» (formatPrice). После записи — revalidatePath('/'), ('/cart'), ('/checkout') (чтения uncached, но клиентские тоталы получают настройки пропсами из RSC — нужен revalidate для перерендера).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Схема + страница + форма (рубли → копейки, превью)
- [ ] Upsert в settings через `getDeliverySettings()`-совместимые ключи
- [ ] revalidatePath после записи
- [ ] Приёмка: 199→299 → корзина и чекаут показывают новую доставку; бесплатный порог пересчитался
