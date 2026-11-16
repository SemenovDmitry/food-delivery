# 03: /email — привязка email (код из Mailpit → emailVerified)

**What to build:** Поток «привязать email потом» (Q1/Q5): `(auth)/email/page.tsx` — RSC-гард (без сессии → `/login`; `emailVerified` → `/orders`) + клиентская форма двух шагов: email → `linkEmail` action (уникальность, UPDATE, запрос кода у emailOTP → Mailpit) → код 6 цифр → `authClient.emailOtp.verifyEmail` → `emailVerified` → redirect `/orders`. Возобновляемый: повторный вход шлёт новый код.

**Blocked by:** 01

**Status:** resolved

- [x] `(auth)/email/page.tsx`: RSC-гард (сессия/emailVerified), metadata «Привязка email», Suspense-паттерн
- [x] Форма: шаг «email» (label + aria-invalid + aria-describedby) → `linkEmail` → ошибки inline («Этот email уже используется», «Email уже привязан», «Не удалось отправить письмо»); шаг «code»: «Код отправлен на …» (aria-live) + 6-значный ввод → `authClient.emailOtp.verifyEmail({ email, otp })` → ошибка «Код неверный или истёк», успех → redirect `/orders`
- [x] Кнопки «Изменить email» и «Отправить ещё раз» на шаге кода
- [x] Убедиться: письмо реально падает в Mailpit (:8025) с 6-значным случайным кодом (sendVerificationOTP из `lib/auth.ts`), без `SMTP_HOST` — в консоль (§5.15)
