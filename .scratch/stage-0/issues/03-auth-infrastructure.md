# 03: Auth-инфраструктура better-auth (телефон + OTP-фейк, email-верификация)

**What to build:** вход по телефону работает на уровне API: демо-OTP всегда `1111`, сессия создаётся; email-верификация уходит письмом через SMTP в Mailpit. UI вкладок входа — этап 3, здесь только инфраструктура.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] better-auth + drizzleAdapter + phoneNumber plugin; роли — additionalField admin/manager/customer с `input: false`; cookieCache 5 мин
- [x] `sendOTP`: код из `DEMO_SMS_OTP_CODE` (по умолчанию `1111`) → console.log + строка в `notifications` (event otp.auth, статус sent)
- [x] Route handler `/api/auth/[...all]` (toNextJsHandler)
- [x] curl-прогон: вход демо-аккаунта по телефону с OTP `1111` → сессия создана, cookie выставлен
- [x] Email-верификация: письмо со случайным кодом уходит SMTP → письмо видно в Mailpit (:8025); без `SMTP_HOST` — код в консоль
- [x] session-утилиты (getSession, getAdminSession), auth-client
