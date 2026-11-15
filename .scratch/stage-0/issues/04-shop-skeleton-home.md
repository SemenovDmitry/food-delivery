# 04: Каркас магазина и главная (акции + sticky-навигация + меню)

**What to build:** главная страница магазина целиком: «Акции недели» над меню, sticky-навигация по категориям с якорным скроллом и scrollspy, поиск, меню сгруппировано по категориям, карточки товаров с emoji-фолбэком.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] layout: lang="ru", skip-link, ThemeProvider (attribute=class, system), Toaster, Geist latin+cyrillic
- [ ] header: навигация Меню/Акции/Ассистент, ThemeToggle (обе иконки рендерятся, видимость через dark: классы, без mounted-состояния), AuthArea на useSession; footer
- [ ] «Акции недели» — Suspense: getActivePromotions (кеш данных isActive=true, окно дат — фильтр на чтении вне кеша, тег `promos`), ссылка «все →» на /promo
- [ ] Sticky-навигация: якорные ссылки `#pizza`/`#shawarma`/`#sets`/`#drinks`/`#desserts`, секции с scroll-margin-top под высоту sticky-блока, плавный скролл через CSS с уважением prefers-reduced-motion, scrollspy — клиентский компонент на IntersectionObserver
- [ ] Поиск: нативная GET-форма `?q`, searchParams читаются в Suspense-скоупе; параметра `?category` в схеме нет
- [ ] Меню сгруппировано по категориям в порядке Пицца → Шаурма → Сеты → Напитки → Десерты
- [ ] product-card: emoji-фолбэк при пустом imageUrl, зачёркнутая старая цена у сетов, бейдж выгоды; promo-card (+formatDiscount)
- [ ] queries: getFullMenu/getProduct — `'use cache'` + `cacheLife('hours')` + тег `menu`; TTL профилей сверён с `node_modules/next/dist/docs`
- [ ] lib/format: formatPrice, formatDate, formatDateTime, STATUS_LABELS
- [ ] `GET /` → 200; a11y: landmarks, один h1, aria-live для результатов поиска; ссылки Акции/Ассистент могут вести на несуществующие маршруты (этапы 2/6) — приемлемо
