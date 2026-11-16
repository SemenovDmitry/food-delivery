# 08: /admin/promotions — CRUD с условиями, удаление, updateTag('promos')

**What to build:** `getAllPromotions()` в `queries/promotions.ts` — uncached, БЕЗ фильтров isActive/isPublic (задел комментария этапа 2). Схема `lib/schemas/promotion.ts`: name, code (nullable, уникальность — серверная ошибка при дубликате), discountType `percent|fixed`, discountValue (>0; percent ≤100), categoryId nullable (null = весь заказ), minTotal, startsAt/endsAt nullable (`datetime-local` строка → Date; оба пустых = без окна; локальное время), isActive, isPublic (переключатель — задел этапа 2). Actions (`lib/actions/promotions.ts`, admin-guard, `updateTag('promos')` — §5.29): create/update/setActive/delete; delete — Dialog-подтверждение, FK `orders.promoId`/`carts.promoId` уже `set null` (схема), **promoName-снапшот НЕ делаем** (Q23: квитанция деградирует до «Скидка −X ₽» — осознано). Страницы: список `/admin/promotions` (таблица: код, имя, тип/размер, скоуп, minTotal, окно, бейджи «активна»/«публичная», пагинация+perPage) + формы-страницы `/admin/promotions/new|[id]` (паттерн товаров).

**Blocked by:** 02

**Status:** resolved

- [ ] `getAllPromotions()` без фильтров
- [ ] Схема + actions (create/update/setActive/delete + updateTag('promos'))
- [ ] Список с бейджами и пагинацией
- [ ] Формы: окно datetime-local, скоуп-категория, isPublic
- [ ] Приёмка: правка видна на витрине/в блоке корзины без холодного кеша (updateTag); удаление использованной акции → квитанция показывает безымянную скидку; дубликат кода → серверная ошибка
