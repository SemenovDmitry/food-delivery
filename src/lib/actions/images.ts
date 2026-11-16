'use server'

import { createHash } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import sharp from 'sharp'
import { db } from '@/db'
import { products } from '@/db/schema'
import { imageUrlFor, S3_BUCKET, s3Client } from '@/lib/s3'
import { requireAdmin } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Загрузка фото товара (этап 5, Q7/Q8): FormData → sharp (width 800 без
 * апскейла → webp q80) → PutObject с immutable-кешем → ключ в products.imageUrl.
 * Ключ = хэш содержимого: новая картинка = новый URL, immutable безопасен.
 * Старый объект удаляется (без сирот в бакете).
 */
export async function uploadProductImage(
	productId: string,
	formData: FormData,
): Promise<ActionResult<{ imageUrl: string; src: string | null }>> {
	await requireAdmin()

	if (!/^[0-9a-f-]{36}$/i.test(productId)) return { data: null, error: 'Товар не найден' }
	const [product] = await db
		.select({ id: products.id, imageUrl: products.imageUrl })
		.from(products)
		.where(eq(products.id, productId))
	if (!product) return { data: null, error: 'Товар не найден' }

	const file = formData.get('file')
	if (!(file instanceof File) || file.size === 0) return { data: null, error: 'Файл не выбран' }
	if (file.size > MAX_UPLOAD_BYTES) return { data: null, error: 'Файл больше 5 МБ' }
	if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
		return { data: null, error: 'Поддерживаются JPEG, PNG и WebP' }
	}

	const input = Buffer.from(await file.arrayBuffer())
	const webp = await sharp(input)
		.resize({ width: 800, withoutEnlargement: true })
		.webp({ quality: 80 })
		.toBuffer()

	const hash = createHash('sha256').update(webp).digest('hex').slice(0, 24)
	const key = `products/${productId}/${hash}.webp`

	await s3Client.send(
		new PutObjectCommand({
			Bucket: S3_BUCKET,
			Key: key,
			Body: webp,
			ContentType: 'image/webp',
			CacheControl: 'public, max-age=31536000, immutable', // год в браузере (Q8)
		}),
	)

	await db
		.update(products)
		.set({ imageUrl: key, updatedAt: new Date() })
		.where(eq(products.id, productId))

	// прежний объект больше не нужен — ключ сменился
	const oldKey = product.imageUrl
	if (oldKey && oldKey !== key) {
		try {
			await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldKey }))
		} catch {
			// сирота в бакете не критична — не роняем загрузку
		}
	}

	updateTag('menu')
	revalidatePath('/')
	revalidatePath(`/admin/products/${productId}`)
	return { data: { imageUrl: key, src: imageUrlFor(key) }, error: null }
}

/** «Убрать фото»: imageUrl → null + удаление объекта; витрина вернётся к emoji-фолбэку */
export async function removeProductImage(
	productId: string,
): Promise<ActionResult<{ removed: true }>> {
	await requireAdmin()

	if (!/^[0-9a-f-]{36}$/i.test(productId)) return { data: null, error: 'Товар не найден' }
	const [product] = await db
		.select({ imageUrl: products.imageUrl })
		.from(products)
		.where(eq(products.id, productId))
	if (!product) return { data: null, error: 'Товар не найден' }

	await db
		.update(products)
		.set({ imageUrl: null, updatedAt: new Date() })
		.where(eq(products.id, productId))

	if (product.imageUrl) {
		try {
			await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: product.imageUrl }))
		} catch {
			// см. upload: сирота не критична
		}
	}

	updateTag('menu')
	revalidatePath('/')
	revalidatePath(`/admin/products/${productId}`)
	return { data: { removed: true }, error: null }
}
