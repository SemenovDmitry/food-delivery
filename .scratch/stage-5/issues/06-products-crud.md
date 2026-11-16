# 06: /admin/products — CRUD single+set, isActive, удаление с гвардом, position/DnD

**What to build:** Схема `lib/schemas/product.ts`: name, description?, price в **рублях** (input) → transform ×100 → копейки, type `single|set`, emoji (колонка есть, default '🍽️'), categoryId, isActive. Actions (`lib/actions/products.ts`, admin-guard, `updateTag('menu')`): create (position = max+1 внутри категории), update, setActive, delete — гвард: count `set_items` по товару → error «Товар входит в N сетов — сначала уберите оттуда» (FK restrict); корзины — каскад (исчезает из корзин сам, факт схемы), заказы переживают (снапшот + set null). Список `/admin/products`: чипы `?category=<id>` (паттерн `?status=`), пагинация + perPage (Q19), строка: emoji-превью, имя, категория, цена, type, бейдж «активен/скрыт», ссылки. Формы-страницы (RHF+zod): `/admin/products/new`, `/admin/products/[id]` — переключатель isActive + кнопка удаления (Dialog). Редактор состава при type=set: `useFieldArray` — строки «товар (select) + qty (Counter)», дубликаты товара запрещены (unique в схеме). DnD reorder внутри отфильтрованной категории (dnd-kit из тикета 05) → reorder-эшн. `getFullMenu`: фильтр `isActive = true`; деактивация корзины не трогает (Q16). Картинки в этом тикете НЕТ (emoji-превью, тикет 07).

**Blocked by:** 01, 05

**Status:** resolved

- [ ] Схема + actions (create/update/setActive/delete/reorder + гварды + updateTag)
- [ ] Список: чипы `?category=`, пагинация+perPage, бейджи
- [ ] Формы new/[id]: RHF+zod, рубли→копейки, isActive, delete-Dialog
- [ ] Редактор состава сета (useFieldArray, без дубликатов)
- [ ] DnD reorder внутри категории
- [ ] `getFullMenu`: фильтр isActive
- [ ] Приёмка: скрытый пропал из меню / остался заказываемым в корзине; удаление товара из сета → toast; удалённый исчез из корзины; порядок в категории виден на витрине
