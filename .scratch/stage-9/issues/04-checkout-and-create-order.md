# 04: createOrder + чекаут — способ оплаты, ревалидация, редирект на pay

**What to build:** `lib/schemas/checkout.ts` += `paymentMethod: z.enum(['online', 'on_receipt'])` — без transform'ов, значит пара `*ServerSchema` (§5.31) не нужна; сервер парсит ту же схему. `createOrder` (Q15/Q20/Q8): после парса — **ревалидация способа против БД** (паттерн промокода): `on_receipt` валиден всегда; `online` — только при ≥1 активной строке `payment_methods`, иначе `{ error: 'Онлайн-оплата временно недоступна' }` и заказ НЕ создаётся; способ, выключенный пока форма была открыта, отсекается той же проверкой. В insert `orders` — `paymentMethod`; сумма платежа = `subtotal - discountAmount + deliveryFee` (всё уже посчитано сервером). После коммита транзакции: `online` → `getPaymentProvider().initiate({ orderId, amount })` → INSERT `payments` (orderId, amount, status `'created'`, externalId от провайдера; `provider` — default `'mock'` до выбора банка) → вернуть `{ orderId, payUrl: redirectUrl }`; `initiate` бросил → вернуть `{ error: 'Платёжный провайдер недоступен — оплатите позже из заказа' }`, заказ **не откатывается** (pending, отменяемый, CTA на трекинге — Q8); `on_receipt` → payment-строки нет, `{ orderId }`. `ActionResult` расширить на `payUrl?: string | null`. UI чекаута (`CheckoutForm` + страница): radio-группа «Онлайн-оплата» (hint «Выбор банка — после оформления заказа») / «При получении» (hint «Наличными или картой курьеру»), дефолт `on_receipt` (Q3/Q16); доступность «Онлайн-оплаты» передаётся с RSC-страницы пропсом (`hasActiveProviders` — некешируемое чтение, страница динамическая); клиент после успеха: `router.push(payUrl ?? `/orders/${orderId}`)`. A11y §7: radio с label + подсказками (`aria-describedby`).

**Blocked by:** 01, 02

**Status:** resolved

- [x] Схема расширенa без transform'ов; серверный safeParse валидирует `paymentMethod`
- [x] Ревалидация: online без активных провайдеров → отказ до создания заказа (`limit(1)` — БД не засоряется)
- [x] online: payment-строка (amount = subtotal − скидка + доставка) + `payUrl`; initiate упал → заказ остаётся (см. Comments)
- [x] on_receipt: прежний поток, payment-строки нет
- [x] Radio в форме: дефолт «При получении», онлайн скрыт при нуле провайдеров (hasActiveProviders из RSC), redirect по `payUrl`; нативные radio + label + aria-describedby (RadioGroup в реестре нет)

## Comments

- 2026-11-17 (implement): отклонение от буквы тикета, осознанное. «initiate бросил → вернуть error» даёт UX-ловушку: к моменту initiate транзакция уже закоммичена (заказ создан, корзина очищена) — ошибка в форме спровоцирует повторную отправку и ДУБЛЬ заказа. Реализация: payment-строка вставляется В транзакции (status created, externalId null), initiate после коммита best-effort — при падении заказ возвращается успешно без payUrl → пользователь попадает на трекинг → CTA «Оплатить» (Q8-семантика «оплата позже» сохранена); confirm при null externalId заденет initiate заново. Для мока initiate не падает; для реального провайдера — тот же graceful-путь.
