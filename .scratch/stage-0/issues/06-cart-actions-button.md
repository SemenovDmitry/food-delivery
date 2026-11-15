# 06: Actions корзины/заказа + кнопка «В корзину»

**What to build:** бэкенд-слой корзины и заказа готов; кнопка «В корзину» на карточке реально кладёт товар в серверную корзину (БД + cookie гостя) с оптимистичным UI. UI корзины и чекаута — этап 1.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Actions корзины (`'use server'`): addToCart/setQty/removeFromCart — гостю httpOnly-cookie `cart_id` (uuid), запись в carts/cart_items, уникальность пары cart+product
- [ ] add-to-cart-button на карточках: server action + useOptimistic + toast
- [ ] Демо: клик «В корзину» с карточки → toast + запись в cart_items + cookie `cart_id`; корзина переживает перезагрузку
- [ ] createOrder(payload): состав из корзины в БД (клиентским спискам не доверять), снапшот цен из БД, ревалидация промокода, запись в db.transaction(), revalidateTag('orders'), результат `{ ok, data: { orderId } }` — тип ActionResult
- [ ] applyPromoCode(code): валидация акции, promo_id на корзину
- [ ] Полная приёмка createOrder/applyPromoCode — на этапе 1 (UI корзины); здесь — lint/build и код-ревью
