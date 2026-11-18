# 01: vitest-скелет + юнит-тесты чистых функций lib

**What to build:** dev-dep `vitest` (pnpm add -D vitest); `vitest.config.ts` в корне — alias `@` → `./src` (fileURLToPath), `test.include: ['src/**/*.test.ts']`, `environment: 'node'`; скрипт `"test:unit": "vitest run"` в package.json. Тесты **ко-локация**: `*.test.ts` рядом с модулями в `src/lib/`. Импорты `describe/it/expect` — явные из 'vitest' (без globals — tsc-совместимо без правки tsconfig). Biome/tsc покрывают тестовые файлы автоматически (пути уже в `**`-охвате). Скоуп (Q16): **promo** (calcDiscount: percent floor `floor(base*value/100)`, fixed `min(value, base)`, скоуп по категории, minTotal сравнивается с полной суммой корзины, причины «Нужен заказ от …»/«В корзине нет товаров из акции»; isPromoInWindow — границы включительно; promoStateReason — isActive первичен; filterPromosInWindow; toCalcLines), **cart-totals** (computeTotals: 199₽ ниже порога, 0 от 1000₽, порог от суммы ДО скидки, самовывоз 0 всегда, скидка только при stateReason=null, невалидный по calcDiscount промо → 0, итог = subtotal − discount + fee), **order-timeline** (nextStatuses: created→[preparing, cancelled_by_vendor], preparing→[ready, …vendor], ready+delivery→[in_delivery, …vendor], ready+pickup→[picked_up, …vendor], in_delivery→[delivered], терминальные→[]; ACTIVE/TERMINAL/CANCELLABLE состав; isOrderStatus кривое значение false; isTerminalStatus; fulfillmentOf дефолт delivery), **phone** (8→+7, +7 уже с плюсом, 10 цифр → префикс 7, уже-нормализованный строкой, мусор → null, 11 цифр не с 7/8 → null), **format** (formatPrice: 19900→«199 ₽», 1234→«12,34 ₽», 123400→«1 NBSP 234 ₽» — NBSP=U+00A0; formatDiscount percent/fixed; plural 1/2/5/11/21/22; STATUS_LABELS — лейбл на каждый ORDER_STATUSES), **payments/hmac** (раундтрип sign→verify true; подделка тела/секрета → false; подпись другой длины → false; формат 64-hex; WEBHOOK_SIGNATURE_HEADER), **id** (isUuid валидный/uppercase/пустой/обрезанный/мусор; shortOrderId). format.test — formatDate/formatDateTime НЕ тестируются (локаль/таймзона машины — комментарий в файле). **Находка гриллинга**: `lib/ws-protocol.ts` type-only — юниты бессмысленны, в скоуп не брать. Фикстуры промо: полный Promotion для isPromoInWindow/promoStateReason (поля таблицы promotions — schema.ts:162), CalcPromo/CalcLine для calcDiscount.

**Blocked by:** —

**Status:** resolved

- [x] `vitest` в devDeps; `vitest.config.mts` (alias `@`, include src/**); скрипт `test:unit`
- [x] Тест-файлы ×7 ко-локация: promo/cart-totals/order-timeline/phone/format/hmac/id
- [x] `pnpm test:unit` зелёный — **65 тестов / 7 файлов** (все кейсы выше)
- [x] `pnpm lint` + `tsc --noEmit` зелёные (biome check чист)
- [x] pre-commit НЕ изменён (Q6)

## Comments

- 2026-11-18 (реализация): конфиг — **`vitest.config.mts`**, не `.ts`: repo без `"type": "module"`, Vite грузит .ts-конфиг как CommonJS → warning `configLoader: 'native'`; переименование снимает его без правки package.json (не рискнём для next/drizzle конфигов).
- NBSP-ожидания `formatPrice` (`1\u00A0234 ₽`, запятая в копейках) подтвердились на Node 20 full-icu под Windows — ru-RU-локаль стабильна и в CI.
- `ws-protocol` исключён как type-only (факт найден при чтении, задан в тикете заранее); `formatDate/DateTime` осознанно без тестов (таймзона машины) — комментарий в format.test.ts.
- Фикстура `toCalcLines` — минимальный CartLine через `as` (Product-подмножество совместимо по присваиваемости, полный Product не нужен).
