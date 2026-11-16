# 07: Картинки — S3 + sharp, ключ в БД, immutable-кеширование

**What to build:** Deps `@aws-sdk/client-s3` + `sharp` (при предупреждении pnpm — флип `allowBuilds.sharp: true`, §5.4). `lib/s3.ts`: S3Client из env (`S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET`), `imageUrlFor(key)` = `${S3_ENDPOINT}/${S3_BUCKET}/${key}` (null-safe) — **в БД хранится ключ**, URL строится при рендере из env (Q7: переживает §5.26 dev↔prod — каждый стек строит свой URL). Action `uploadProductImage(productId, FormData)` (admin-guard): File ≤5 МБ jpeg/png/webp → sharp: resize width 800 без апскейла → webp q80 → key `products/<productId>/<sha256>.webp` → `PutObject` c `CacheControl: 'public, max-age=31536000, immutable'` (Q8: безопасен из-за хэш-ключа) → удалить предыдущий объект → `updateTag('menu')`. Отдельная кнопка «Убрать фото»: `imageUrl = null` + deleteObject. Замена в форме товара: file input + превью текущего. next.config: `images: { remotePatterns: [{ protocol, hostname: new URL(env.S3_ENDPOINT).hostname }], minimumCacheTTL: 30*24*3600 }` (браузер MinIO не фетчит — только `/_next/image`). Сидер: идемпотентное создание бакета + public-read policy (анонимный GET для оптимизатора). Карточка/детали товара: `<Image>` по `imageUrlFor(product.imageUrl)`, emoji-фолбэк при null (механизм уже есть — заменить источник URL).

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Deps + allowBuilds (если pnpm попросит)
- [ ] `lib/s3.ts`: клиент + `imageUrlFor` + upload/remove
- [ ] sharp: 800px/webp q80/≤5МБ/хэш-ключ + удаление старого объекта
- [ ] next.config: remotePatterns из env + minimumCacheTTL
- [ ] Сидер: бакет + public-read policy идемпотентно
- [ ] Форма товара: upload/replace/remove; карточка и детали рендерят `<Image>`
- [ ] Приёмка: загрузка → фото на карточке и в витрине; заголовки `/_next/image` — immutable/долгий TTL; prod-compose (hostname `minio`) показывает те же фото; §5.26-сценарий: фото, залитое в dev, видно в prod
