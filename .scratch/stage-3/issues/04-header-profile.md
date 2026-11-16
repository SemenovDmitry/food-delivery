# 04: Шапка — меню профиля вместо имени (Q3)

**What to build:** Авторизованная зона шапки без имени/телефона: иконка-кнопка `UserRound` (aria-label «Профиль») → DropdownMenu: «Мои заказы» → /orders, «Привязать email» → /email (только пока `!emailVerified`), разделитель, «Выйти». Гость — «Войти» как есть.

**Blocked by:** 02

**Status:** resolved

- [x] Header: авторизован → DropdownMenu (components/ui/dropdown-menu): trigger — Button ghost size icon, `<UserRound aria-hidden>`, `aria-label='Профиль'`
- [x] Пункты: «Мои заказы» (Link /orders), «Привязать email» (Link /email, условие `!session.user.emailVerified`), Separator, «Выйти» (await `authClient.signOut()` → `router.push('/')` + refresh)
- [x] Клавиатурность и focus-visible из DropdownMenu radix; label пунктов без иконок-картинок со смыслом
- [x] Бейдж корзины и поиск не сломаны; после «Привязки email» пункт исчезает (useSession обновляется после verify-email refresh cookie-кеша)
