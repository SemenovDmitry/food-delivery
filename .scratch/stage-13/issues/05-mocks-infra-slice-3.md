# 05: Слайс 3 — мок-инфраструктура (8 action-модулей + auth-client)

**What to build:** (Q2 спеки слайса 3) Расширение `.storybook/mocks/` + алиасов `viteFinal` в `main.ts` под 18 новых компонентов:

- 8 новых action-модулей по typeof-паттерну (сигнатуры = `typeof ProdFn` из `import type *` — drift ловит tsc): `auth-actions.ts` (sendLoginOtp / sendRegisterOtp / linkEmail / mergeGuestCartOnAuth), `categories-actions.ts` (createCategory / updateCategory / reorderCategories / deleteCategory), `products-actions.ts` (createProduct / updateProduct / setProductActive / deleteProduct / reorderProducts), `images-actions.ts` (uploadProductImage / removeProductImage — success-ветка возвращает `{ data: { imageUrl, src }, error: null }`, не null-data), `promotions-actions.ts` (createPromotion / updatePromotion / setPromotionActive / deletePromotion), `users-actions.ts` (banUser / unbanUser / archiveUser), `settings-actions.ts` (saveDeliverySettings), `payments-actions.ts` (setPaymentMethodActive)
- `order-actions.ts` += `repeatOrder` (typeof-паттерн; успех `{ added: N }`)
- **новый `auth-client.ts` мок** ← `@/lib/auth-client`: `authClient.useSession()` (форма better-auth `{ data, isPending, error }`; user: name/email/emailVerified/role — ровно то, что читает header), `signOut()`, `phoneNumber.verify()`, `emailOtp.verifyEmail()` + **`__setSession(state)`** — 'guest' | 'pending' | user-объект. Типизация РУЧНАЯ (typeof authClient нецелевой — клиент better-auth тянет плагины/fetch-типы); в шапке мока — комментарий о drift-риске: новый метод в компоненте → дополнить мок руками
- `main.ts` viteFinal: +9 алиасов (8 actions + auth-client) — 2 → 11

**Blocked by:** — (04 этапа 13 resolved)

**Status:** resolved

- [x] 8 action-модулей + `repeatOrder` в order-actions; typeof-сигнатуры (tsc ловит drift)
- [x] auth-client мок с `__setSession` + drift-комментарий в шапке
- [x] `main.ts` += 9 алиасов (2 → 11)
- [x] `pnpm build-storybook` зелёный (алиасы не роняют сборку)

## Comments

- 2026-11-20 (реализация): `__setSession` импортируется в header-сторях **относительным путём** `../../../.storybook/mocks/auth-client` — tsc видит `.storybook` через include `**/*.ts` (тип REAL-модуля из алиаса не знал бы `__setSession`), а vite резолвит относительный путь в тот же файл, что и алиас — один инстанс модуля, состояние сессии общее. images-actions: upload возвращает реальную success-форму `{ imageUrl, src }` (null-data сломал бы ActionResult-дискриминант).
