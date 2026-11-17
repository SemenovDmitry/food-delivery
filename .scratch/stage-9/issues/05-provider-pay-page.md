# 05: Платёжная страница (provider)/orders/[id]/pay — шаги, countdown, грани

**What to build:** Route group `src/app/(provider)/` — путь `/orders/[id]/pay` без шапки магазина (Q10): `layout.tsx` с минимальным хромом провайдера (логотип-заглушка «ШаурмаPay», тёмно/светлая тема через те же CSS-токены §7; Header/Footer и чат-виджет сюда НЕ попадают — они в `(shop)/layout`). RSC-страница `page.tsx`: `isUuid` → notFound (§5.24); динамические чтения за `connection()`/Suspense-гейтом (§5.33); загрузить order + payment + активные провайдеры (position-порядок) + окно; **грани (Q7)**: заказ paid → redirect `/orders/<id>`; терминальная отмена (любая причина) → redirect (баннер на трекинге); `on_receipt` → redirect; payment-строки нет → redirect; не найдено → notFound. Клиентский компонент, два шага: **шаг 1** — «Выберите банк для оплаты» (radio из активных провайдеров; ноль активных → сообщение «Онлайн-оплата недоступна» + линк на трекинг); **шаг 2** — заглушка банка: «Вы оплачиваете через <label>», сумма, «Оплатить» и «Отмена»; обе кнопки бьют `POST /api/payments/mock/confirm` (`action: 'pay' | 'cancel'`, Q19); успех → `router.push(redirectUrl)`; провал (409 expired/conflict) → тост + возврат на шаг 1 / редирект на трекинг для expired. **Countdown 5:00** от `orders.createdAt` + `PAYMENT_WINDOW_MINUTES` (`setInterval`, чистый интервал; при 0 — кнопки disabled + «Время оплаты истекло» + линк на трекинг); `retry` после `failed` — шаг 1 активен до конца окна (Q7/Q19). RepeatOrderButton и прочий шоп-хром — НЕ здесь. A11y §7: labels radio, focus-visible, countdown `aria-live="polite"` на последних секундах или по завершении.

**Blocked by:** 03, 04

**Status:** open

- [ ] `(provider)/orders/[id]/pay` открывается без Header/Footer/чата; хром провайдера в обеих темах
- [ ] Грани: paid / отменён / on_receipt / без payment → redirect на трекинг; не-uuid → 404
- [ ] Шаг 1 → шаг 2 → confirm(pay) → redirect на трекинг; «Отмена» → confirm(cancel) → шаг 1, payment failed
- [ ] Countdown от createdAt: ноль дизейблит кнопки; expired-ответ возвращает на трекинг
- [ ] A11y: radio labels, focus-visible, живое объявление истечения
