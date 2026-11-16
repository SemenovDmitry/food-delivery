# 01: Телефонная нормализация, schemas, server actions auth

**What to build:** Фундамент этапа без UI: `lib/phone.ts` (чистая нормализация RU-телефона в канон сидера), `lib/schemas/auth.ts` (RHF+zod схемы: телефон с нормализацией, SMS-код 4 цифры, email-код 6 цифр, email для привязки), `lib/actions/auth.ts` (ActionResult: `sendLoginOtp`, `sendRegisterOtp`, `linkEmail`, `mergeGuestCartOnAuth`). Гardy существования — ДО вызова `auth.api.sendPhoneNumberOTP` (спека «Механика», п. 2–3).

**Blocked by:** —

**Status:** resolved

- [x] `lib/phone.ts`: `normalizeRuPhone(input): string | null` — digits-only → `8XXXXXXXXXX`→`7…`, 10 цифр → префикс `7`, итог ровно `+7 XXX XXX-XX-XX` (формат сидера `+7 999 000-00-01`); иначе null. Чистая, без server-only (нужна и клиенту для transform)
- [x] `lib/schemas/auth.ts`: `authPhoneSchema` (transform через normalizeRuPhone + refine с подсказкой «Введите номер в формате +7 999 000-00-01»), `smsCodeSchema` (ровно 4 цифры), `emailCodeSchema` (ровно 6 цифр), `linkEmailSchema` (email: trim + lowercase + валидация). Типы = `z.infer`
- [x] `lib/actions/auth.ts` — `sendLoginOtp(phoneRaw)`: парсинг `authPhoneSchema` → SELECT user по phoneNumber → нет: `{ error: 'Номер не зарегистрирован — зарегистрируйтесь' }` → есть: `auth.api.sendPhoneNumberOTP({ body: { phoneNumber } })`; ошибки API → общий текст «Не удалось отправить SMS»
- [x] `sendRegisterOtp(phoneRaw)`: парсинг → SELECT → есть: `{ error: 'Этот номер уже зарегистрирован — войдите' }` → нет: sendPhoneNumberOTP
- [x] `linkEmail(emailRaw)`: `getSession()` без сессии → error; `linkEmailSchema` → если `emailVerified` → «Email уже привязан»; SELECT по email → занят: «Этот email уже используется»; `UPDATE user SET email, updated_at` → `auth.api.sendVerificationOTP({ body: { email, type: 'email-verification' } })`
- [x] `mergeGuestCartOnAuth()`: сессия + cookie `cart_id` → гостевая корзина; у юзера нет корзины → усыновление (userId на гостевую); обе есть → `db.transaction()`: qty суммируются с капом MAX_QTY, промо `userCart.promoId ?? guestCart.promoId`, гостевая удалена; cookie снята в обоих случаях; пустая гостевая → просто удалить + снять cookie; no-op без сессии/cookie; `revalidatePath('/')`
- [x] Ошибки better-auth API не роняют action: try/catch → ActionResult с текстом UI
