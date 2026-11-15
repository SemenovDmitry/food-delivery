import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

// jsx-a11y добавляем ТОЛЬКО правилами (AGENTS.md §5.6). Нюанс ESLint 9 + flat config:
// правила «jsx-a11y/…» требуют, чтобы плагин был объявлен в том же конфиг-объекте,
// но повторная регистрация даёт «Cannot redefine plugin jsx-a11y». Решение — взять
// УЖЕ зарегистрированный eslint-config-next инстанс из его конфиг-объектов.
const registeredJsxA11y = nextVitals.find(
  (config) => config.plugins?.["jsx-a11y"],
)?.plugins?.["jsx-a11y"];

const jsxA11yConfig = {
  plugins: { "jsx-a11y": registeredJsxA11y ?? jsxA11y },
  rules: jsxA11y.flatConfigs.recommended.rules,
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  jsxA11yConfig,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
