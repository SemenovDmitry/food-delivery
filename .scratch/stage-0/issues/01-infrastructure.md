# 01: Инфраструктура — каркас Next.js в Docker (postgres + minio + mailpit)

**What to build:** пустой, но полный каркас приложения, интегрированный в Docker: `pnpm dev` открывает заглушку главной; `docker compose up` (dev-профиль) поднимает postgres + minio + mailpit; `docker build` проходит; всё окружение описано в `.env.example`; shadcn инициализирован с набором компонент для этапа.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] create-next-app: Next 16.4, TS strict, Tailwind v4, `src/`, pnpm 11
- [x] next.config: `cacheComponents`, `partialPrefetching`, `reactCompiler` (+ dev-dep babel-plugin-react-compiler), `output: 'standalone'`
- [x] pnpm-workspace.yaml: `allowBuilds` (esbuild)
- [x] ESLint: jsx-a11y только правилами из flatConfigs.recommended.rules
- [x] `.env.example`: DATABASE_URL, S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET, AUTH_SECRET, AI-ключи, SMTP_HOST/SMTP_PORT, DEMO_SMS_OTP_CODE, DEMO_AUTO_STATUS(+_INTERVAL), PAYMENT_PROVIDER, PAYMENTS_WEBHOOK_SECRET
- [x] docker-compose.dev.yml: postgres:17 + minio + mailpit (SMTP :1025, UI :8025); docker-compose.prod.yml: app + postgres + minio
- [x] multi-stage Dockerfile (pnpm, standalone): `docker build` проходит
- [x] shadcn init (radix/nova, --css-variables) + компоненты: button card input label textarea select badge dialog sheet separator sonner skeleton dropdown-menu table tabs switch
- [x] Geist latin+cyrillic → переменная `--font-sans`
- [x] `docker compose up` → приложение отвечает (заглушка главной)
- [x] CLAUDE.md (→ указатель на AGENTS.md), README.md (roadmap обучения)
