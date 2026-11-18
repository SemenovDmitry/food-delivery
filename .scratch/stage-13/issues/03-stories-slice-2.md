# 03: Стори слайс 2 — интерактивные с моками

**What to build:** (Q13) **cart-interactive** — компонент использует server actions (add/setQty/remove) напрямую? Сверить по коду: если actions импортируются внутри — инъекция зависимости через пропсы-колбэки с дефолтом = текущее поведение (малая правка прод-кода, решение гриллинга); стори: изменение qty (useOptimistic — мгновенная цифра), удаление строки, optimistic-тоталы через computeTotals. **promo-block** — тот же паттерн: применить публичную (из списка), снять активной (✕), причина неприменимости (disabled + текст «Нужен заказ от …»), ввод кода с inline-ошибкой. **checkout-form** — инъекция `onSubmit` с дефолтом текущего action (или проп-параметр, если компонент уже принимает action отдельно — сверить): стори на inline-валидацию (пустые поля → aria-invalid + aria-describedby), заполненную форму, серверную ошибку → Dialog-модалка. **order-tracker** — мок fetch на `GET /api/orders/[id]`: стори-декоратор подменяет window.fetch, «тик» — кнопка/авто-интервал в стори переключает статус (created→preparing→ready) → бейдж меняется, поллинг виден; терминальный статус → поллинг замолкает. **support-chat — вне скоупа** (Q13). Все интерактивности — под axe; на каждую сторию с состоянием — play-функция НЕ обязательна (плейграунд руками, без interaction-тестов — Q14 снапшоты отложены).

**Blocked by:** 02 (этап 13)

**Status:** resolved

- [x] cart-interactive + promo-block: мок-action'ы — **Vite-алиасами** (нулевые правки прод-кода; сдвиг от инъекции из плана, задокументирован в тикете 02 Comments), `typeof`-сигнатуры контролирует tsc
- [x] checkout-form: createOrder замокан алиасом (orders-мок тикета 02); inline-валидация EmptyGuestForm (mode onTouched), PrefilledFromSession, OnlineAvailable/OnlineHidden (Q20)
- [x] order-tracker: 6 состояний через args (created on_receipt/UnpaidOnline+CTA/PaidOnline/InDelivery/Delivered/CancelledByCustomer — баннер вместо таймлайна), поллинг заморожен fetch-декоратором
- [x] `pnpm build-storybook` зелёный; next build не сломан (полный цикл на приёмке)

## Comments

- 2026-11-19 (ревью этапа): **отклонения от плана тикета, зафиксированные при ревью**:
  1. «тик»-кнопка для order-tracker заменена на **состояния через args** — props и есть «смена статуса» (детерминированно, без ожидания 25-с поллинга; живой поллинг ≤35 с покрыт e2e P2-2, терминальное замолкание — P1-3/поллинг e2e).
  2. **inline-ошибка ввода кода и серверная ошибка → Dialog не стали сторями**: код-ошибка живёт во внутреннем состоянии PromoCodeForm и приходит из applyPromoCode — алиас-мок всесильно успешен, per-story фейл потребовал бы правки мок-инфраструктуры; пути покрыты e2e (SECRET15 вводом P2-4, Q12-модалка — приёмка этапа 1). Добавлена сторя **NotApplicable** (disabled + причина «Нужен заказ от 1 000 ₽» через calcDiscount) — закрыла вторую половину этого пункта плана.
  3. add-to-cart-button idle/loading/added: loading/added — клик по стори с мок-действием (optimistic pending → тост), отдельные статичные стори не нужны.
  4. Ревью спеки: `OnlineAvailable` был байт-дублём EmptyGuestForm — стал prefill-вариантом.
