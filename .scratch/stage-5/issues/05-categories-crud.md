# 05: /admin/categories — CRUD + DnD-сортировка (dnd-kit рождается здесь)

**What to build:** Deps `@dnd-kit/core` + `@dnd-kit/sortable` (+utilities): переиспользуемый клиентский sortable-список с **keyboard-сенсором** (a11y-чеклист §7). Схема `lib/schemas/category.ts`: name (min 1), slug (`^[a-z0-9-]+$` — он же якорь `#slug` навигации главной). Actions (admin-guard, `lib/actions/categories.ts`): create (position = max+1), update, reorder(ids) — транзакция `position = индекс массива` (нормализация дыр), delete с гвардом «в категории N товаров» (FK restrict → error → toast); все мутации → `updateTag('menu')` (§5.29). Страница `/admin/categories` (admin-only, тикет 02): DnD-список (имя, slug, N товаров, ручки перетаскивания), create/edit — Dialog (паттерн отмен заказов), delete — Dialog-подтверждение. Без пагинации (Q27: DnD требует весь список). `getFullMenu`: `ORDER BY categories.position` (вторично id). Категория без товаров удаляется свободно.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] dnd-kit + sortable-компонент с keyboard-сенсором
- [ ] Схема + actions (create/update/reorder/delete + гварды + `updateTag('menu')`)
- [ ] Страница: DnD-список + Dialog-формы + delete-гвард
- [ ] `getFullMenu` по position; sticky-нав главной наследует порядок
- [ ] Приёмка: reorder мышью И с клавиатуры → порядок виден на главной (нав + секции); delete категории с товарами → toast
