# 02: (auth) layout + /login + /register — визард «телефон → SMS-код»

**What to build:** Группа `(auth)` с минимальным центрированным layout (без шапки магазина; `<main id='main-content'>`, лого-ссылка «← в меню»). Страницы-близнеца `/login` и `/register`: RSC-обёртка (metadata, гард по сессии, `?redirect=` только локальные пути) + общий клиентский компонент визарда `mode: 'login' | 'register'`. RHF + zod, aria-ошибки. После успешного verify — `mergeGuestCartOnAuth()` → `router.push(redirect || '/orders')`.

**Blocked by:** 01

**Status:** resolved

- [x] `(auth)/layout.tsx`: центрированный контейнер, лого «🌯 Food Delivery» → `/`, `<main id='main-content'>`, один h1 на странице (не в layout)
- [x] RSC-гард: `getSession()` + сессия → redirect (login → redirectParam || '/orders'; register → '/orders'); `searchParams` читается в некешируемом скоупе внутри Suspense (паттерн квитанции §5.3); redirect-параметр валидируется (только `/…`, без `//` и схем)
- [x] Общий визард (клиент): шаг «phone» (InputMode tel, placeholder `+7 999 000-00-01`) → zod → action по mode; шаг «code»: «SMS отправлено на +7 …» + 4-значный ввод → `authClient.phoneNumber.verify({ phoneNumber, code })` → ошибка → «Код неверный или истёк»; успех → `mergeGuestCartOnAuth()` (ошибка merge не блокирует вход) → `router.push`
- [x] Разные тексты/гарды: login — «Вход», ошибка action «Номер не зарегистрирован — зарегистрируйтесь» + Link на /register; register — «Создать аккаунт», «Этот номер уже зарегистрирован — войдите» + Link на /login; кнопки «Изменить номер» и «Отправить ещё раз» на шаге кода
- [x] a11y: label + aria-invalid + aria-describedby для обоих инпутов, aria-live для сообщения «SMS отправлено», фокус на инпут кода при переходе шага
- [x] Кросс-ссылки: на /login «Нет аккаунта? Зарегистрируйтесь», на /register «Уже есть аккаунт? Войдите»
