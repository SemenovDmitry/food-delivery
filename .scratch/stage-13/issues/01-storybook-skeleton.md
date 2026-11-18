# 01: Storybook 10 + nextjs-vite скелет (Tailwind, темы, a11y)

**What to build:** dev-deps: `storybook@^10`, `@storybook/nextjs-vite@^10`, `@storybook/addon-a11y`, `@storybook/addon-essentials`, `@tailwindcss/vite` (Tailwind v4 нативно, Q7). Конфиг `.storybook/main.ts` в корне: framework `@storybook/nextjs-vite`, stories glob `../src/**/*.stories.@(ts|tsx)`, addons essentials + a11y; `viteFinal` — подключить `@tailwindcss/vite` плагин. `.storybook/preview.ts`: импорт `../src/app/globals.css` (токены тем), **theme-toolbar** — globalTypes `theme` (light/dark, toolbar) + декоратор с next-themes `ThemeProvider` (attribute=class, defaultTheme по глобалу, принудительный ключ для ререндера) — обе темы равнозначны (§1); viewport-декоратор не обязателен. Риск next/font (Geist): если SB не разрулит `next/font` из layout — фолбэк-шрифт в preview-декораторе (переменная `--font-sans` на html-элемент стори). Статические ресурсы next/image — nextjs-vite обрабатывает. Скрипты: `"storybook": "storybook dev -p 6006"`, `"build-storybook": "storybook build"`. Проверка: `pnpm storybook` поднимается, `pnpm build-storybook` проходит, `pnpm build`/lint/tsc не сломаны (Biome не ругается на .storybook/ — пути в `**`-охвате; при конфликтах — files.includes-правка, не исключение вслепую). Turbopack-конфликтов нет: SB на Vite, next dev/build не трогается.

**Blocked by:** — (этап запускается после этапа 12)

**Status:** open

- [ ] dev-deps + скрипты `storybook`/`build-storybook`
- [ ] `.storybook/main.ts` (framework nextjs-vite, stories glob, viteFinal + Tailwind)
- [ ] `.storybook/preview.ts` (globals.css, ThemeProvider-декоратор + theme-toolbar light/dark)
- [ ] `pnpm storybook` поднимается; `pnpm build-storybook` зелёный; next/lint/tsc не сломаны
