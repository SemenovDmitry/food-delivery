# 08: Слайс 3 — стори auth + payments (3 компонента / 7 сторей)

**What to build:** (матрица Q6; Q5 — шаг 2 не сторифицируем) — **Auth/AuthPhoneWizard** (2): Вход (mode='login' — гард «войдите») · Регистрация (mode='register' — гард «зарегистрируйтесь»); шаг «SMS-код» — interaction-only, покрыт e2e P1-auth. Моки: auth-actions + auth-client (тикет 05). — **Auth/EmailLinkForm** (1): prefill initialEmail='client@food.local'; шаг «код» — e2e. Те же моки. — **Payments/PayClient** (4): Выбор банка (2 провайдера, «Продолжить» disabled до выбора) · Нет провайдеров (providers=[] → «Онлайн-оплата недоступна») · Повтор после failed (paymentStatus='failed' → плашка повтора) · Окно истекло (createdAtIso в прошлом → «Время оплаты истекло», кнопки disabled); шаг «заглушка банка» — interaction-only, покрыт e2e (P2-платежи); fetch-стаб не нужен — клики не сторифицируем. Без action-моков.

**Blocked by:** 05 (этап 13, слайс 3)

**Status:** resolved

- [x] 3 стори-файла, **6 сторей** (см. Comments — отклонение от матрицы); namespace Auth/…, Payments/…
- [x] Шаг-2 состояния не сторифицированы (Q5)
- [x] `pnpm build-storybook` зелёный

## Comments

- 2026-11-20 (реализация): **отклонение от матрицы спеки — сторь pay-client «Повтор после failed» снята (7→6 сторей)**: плашка «Предыдущая попытка не завершена…» рендерится ТОЛЬКО на шаге 2 (заглушка банка), а шаг 2 — interaction-only по Q5; статичная сторь с paymentStatus='failed' визуально неотличима от «Выбор банка». Путь failed→повтор покрыт e2e (P2-платежи, сценарии этапа 9). Итог слайса: 83 стори (52+31), axe-прогонов 166 (83×2), не 84/168.
