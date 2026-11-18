# 01: Storybook 10 + nextjs-vite скелет (Tailwind, темы, a11y)

**What to build:** dev-deps: `storybook@^10`, `@storybook/nextjs-vite@^10`, `@storybook/addon-a11y`, `@storybook/addon-essentials`, `@tailwindcss/vite` (Tailwind v4 нативно, Q7). Конфиг `.storybook/main.ts` в корне: framework `@storybook/nextjs-vite`, stories glob `../src/**/*.stories.@(ts|tsx)`, addons essentials + a11y; `viteFinal` — подключить `@tailwindcss/vite` плагин. `.storybook/preview.ts`: импорт `../src/app/globals.css` (токены тем), **theme-toolbar** — globalTypes `theme` (light/dark, toolbar) + декоратор с next-themes `ThemeProvider` (attribute=class, defaultTheme по глобалу, принудительный ключ для ререндера) — обе темы равнозначны (§1); viewport-декоратор не обязателен. Риск next/font (Geist): если SB не разрулит `next/font` из layout — фолбэк-шрифт в preview-декораторе (переменная `--font-sans` на html-элемент стори). Статические ресурсы next/image — nextjs-vite обрабатывает. Скрипты: `"storybook": "storybook dev -p 6006"`, `"build-storybook": "storybook build"`. Проверка: `pnpm storybook` поднимается, `pnpm build-storybook` проходит, `pnpm build`/lint/tsc не сломаны (Biome не ругается на .storybook/ — пути в `**`-охвате; при конфликтах — files.includes-правка, не исключение вслепую). Turbopack-конфликтов нет: SB на Vite, next dev/build не трогается.

**Blocked by:** — (этап запускается после этапа 12)

**Status:** resolved

- [x] dev-deps + скрипты `storybook`/`build-storybook`
- [x] `.storybook/main.ts` (framework nextjs-vite, stories glob, viteFinal + Tailwind)
- [x] `.storybook/preview.tsx` (globals.css, ThemeProvider-декоратор + theme-toolbar light/dark)
- [x] `pnpm build-storybook` зелёный (manager + preview + Tailwind-плагин скомпилировались); lint/tsc не сломаны

## Comments

- 2026-11-19 (реализация): **`@storybook/addon-essentials` discontinued с SB 9** (последняя версия 8.6.14) — подключение к storybook@10 даёт exports-мисматч (`Icons` из addon-toolbars@8 против ядра 10, `SB_CORE-SERVER_0004 NoMatchingExportError`); controls/toolbars/viewport/measure/outline входят в ядро storybook@10, аддон не нужен — в main.ts только `@storybook/addon-a11y@10`.
- Шрифт: Geist подкладывается layout'ом через next/font (`--font-sans`, layout.tsx:8) — в стори-iframe его нет; `fontDecorator` ставит системный фолбэк на documentElement.
- Тема: `themeDecorator` — ThemeProvider с `forcedTheme` из toolbar-глобала `theme` (light/dark), `@custom-variant dark` в globals.css подхватывает класс на html iframe.
- `.gitignore` += `storybook-static/`.
