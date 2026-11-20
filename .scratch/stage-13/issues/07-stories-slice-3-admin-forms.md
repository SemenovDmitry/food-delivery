# 07: Слайс 3 — стори админ-форм (7 компонентов / 11 сторей)

**What to build:** (матрица Q6 спеки слайса 3) — **Admin/ProductForm** (3): Создание (product=null) · Редактирование (product-фикстура → delete-кнопка + поле фото; imageSrc=null во всех сторях — next/image remote не конфигурим) · Сет-состав (type='set' → useFieldArray-строки components). Моки: products + images. — **Admin/PromotionForm** (2): Создание (percent-ветка) · Редактирование-скрытый (code='SECRET15', fixed-копейки, isPublic=false, окно дат). Мок: promotions. — **Admin/CategoriesAdmin** (1): AdminCategoryRow[] ×4–5 (slug/position/productCount). Мок: categories. — **Admin/ProductsReorder** (1): ReorderItem[] ×3 (emoji/имя-линк/цена, бейджи Сет/Скрыт). Мок: products. — **Admin/UsersTable** (2): Таблица (строки: клиент / забаненный — бейдж «Заблокирован» + Разбанить / self-row — кнопки disabled по currentUserId) · Пусто. Мок: users. — **Admin/DeliverySettingsForm** (1): prefill 199/1000 + живой предпросмотр. Мок: settings. — **Admin/PaymentMethodsForm** (1): сбер+unionpay активны. Мок: payments. RHF-формы рендерим с дефолтами — inline-валидация/тосты не сторифицируем (пути покрыты приёмкой этапа 5); диалоги (delete/confirm) — interaction-only, не стори. **Первый axe-аудит админ-форм** — найденные нарушения чинить в прод-компонентах (прецедент этапа 13: 5 прод-проблем), не в сторях.

**Blocked by:** 05 (этап 13, слайс 3)

**Status:** resolved

- [x] 7 стори-файлов, 11 сторей; namespace Admin/…
- [x] Формы с дефолтами; диалоги не сторифицированы
- [x] a11y-находки: **0 нарушений во всех 7 админ-компонентах с первого прогона** (Radix-примитивы + aria-паттерны этапа 5 + фиксы этапа 13: статусные токены/destructive контраст уже затемнены)
- [x] `pnpm build-storybook` зелёный
