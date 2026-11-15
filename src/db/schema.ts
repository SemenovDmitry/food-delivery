import {
	boolean,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core'

/**
 * Статусы заказа — фиксированное множество (GLOSSARY «Статус заказа»):
 * цепочка created → preparing → ready, ветка по fulfillment
 * (in_delivery → delivered | picked_up), терминальные отмены.
 */
export const ORDER_STATUSES = [
	'created',
	'preparing',
	'ready',
	'in_delivery',
	'delivered',
	'picked_up',
	'cancelled_by_customer',
	'cancelled_by_vendor',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_PAYMENT_STATUSES = ['pending', 'paid'] as const
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number]

export const PAYMENT_STATUSES = ['created', 'processing', 'paid', 'failed', 'cancelled'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed'] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

// ─── better-auth (user/session/account/verification) ─────────────────────────
// Структура под drizzleAdapter better-auth; расширения — role, phone, email-флаги.

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(), // обязательный, верифицируется кодом (этап 3)
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	/** additionalField better-auth: input: false — роль меняется только из админки */
	role: text('role').notNull().default('customer'),
	/** phone-number plugin: вход по телефону, SMS-OTP (фейк 1111, §5.15) */
	phoneNumber: text('phone_number').unique(),
	phoneNumberVerified: boolean('phone_number_verified').notNull().default(false),
})

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Каталог ─────────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
	id: serial('id').primaryKey(),
	slug: text('slug').notNull().unique(), // pizza | shawarma | sets | drinks | desserts — идентификаторы якорей
	name: text('name').notNull(),
})

export const products = pgTable('products', {
	id: uuid('id').primaryKey().defaultRandom(),
	categoryId: integer('category_id')
		.notNull()
		.references(() => categories.id, { onDelete: 'restrict' }),
	name: text('name').notNull(),
	description: text('description'),
	/** копейки (int) — см. GLOSSARY «Копейка» */
	price: integer('price').notNull(),
	/** single | set */
	type: text('type').notNull().default('single'),
	emoji: text('emoji').notNull().default('🍽️'), // фолбэк, пока нет фото
	imageUrl: text('image_url'), // MinIO, этап 5
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const setItems = pgTable(
	'set_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		setId: uuid('set_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'restrict' }),
		qty: integer('qty').notNull().default(1),
	},
	(table) => [unique('set_items_set_product_unique').on(table.setId, table.productId)],
)

// ─── Акции ───────────────────────────────────────────────────────────────────

export const promotions = pgTable('promotions', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	/** null → акция без кода */
	code: text('code').unique(),
	/** percent | fixed */
	discountType: text('discount_type').notNull(),
	/** percent: 1–99; fixed: копейки */
	discountValue: integer('discount_value').notNull(),
	/**
	 * Скоуп акции (этап 1, гриллинг 2026-11-15): null = скидка на весь заказ,
	 * заполнено = только на товары категории. restrict — удаление категории
	 * не превращает «скидку на шаурму» в «скидку на всё» молча.
	 */
	categoryId: integer('category_id').references(() => categories.id, { onDelete: 'restrict' }),
	/** Минимальная сумма товаров корзины (копейки), 0 = без условия */
	minTotal: integer('min_total').notNull().default(0),
	/** окно действия — фильтр на чтении ВНЕ кеша (§5.3) */
	startsAt: timestamp('starts_at'),
	endsAt: timestamp('ends_at'),
	isActive: boolean('is_active').notNull().default(true),
	/**
	 * Публичность (этап 2, GLOSSARY «Публичная акция»/«Скрытый промокод»):
	 * true → лента «Акции недели», /promo, GET /api/promotions, блок акций корзины;
	 * false → нигде не показывается, единственный путь применения — ввод кода на /cart.
	 */
	isPublic: boolean('is_public').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Корзина (серверная) ─────────────────────────────────────────────────────

export const carts = pgTable('carts', {
	id: uuid('id').primaryKey().defaultRandom(),
	// text: ссылка на user.id (better-auth использует text-идентификаторы)
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	promoId: uuid('promo_id').references(() => promotions.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const cartItems = pgTable(
	'cart_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		cartId: uuid('cart_id')
			.notNull()
			.references(() => carts.id, { onDelete: 'cascade' }),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		qty: integer('qty').notNull().default(1),
	},
	(table) => [unique('cart_items_cart_product_unique').on(table.cartId, table.productId)],
)

// ─── Заказы ──────────────────────────────────────────────────────────────────

export const orders = pgTable('orders', {
	id: uuid('id').primaryKey().defaultRandom(), // неугадываемый uuid → трекинг доступен гостю
	// text: ссылка на user.id (better-auth использует text-идентификаторы)
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	customerName: text('customer_name').notNull(),
	phone: text('phone').notNull(),
	/** delivery | pickup */
	fulfillment: text('fulfillment').notNull(),
	address: text('address'),
	comment: text('comment'),
	promoId: uuid('promo_id').references(() => promotions.id, { onDelete: 'set null' }),
	discountAmount: integer('discount_amount').notNull().default(0),
	/** Копейки, считает сервер (settings + fulfillment), клиент не присылает */
	deliveryFee: integer('delivery_fee').notNull().default(0),
	status: text('status').notNull().default('created'),
	/** pending | paid — под этап 9 */
	paymentStatus: text('payment_status').notNull().default('pending'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const orderItems = pgTable('order_items', {
	id: uuid('id').primaryKey().defaultRandom(),
	orderId: uuid('order_id')
		.notNull()
		.references(() => orders.id, { onDelete: 'cascade' }),
	productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
	/** снапшот из БД на момент заказа (GLOSSARY «Снапшот цены») */
	name: text('name').notNull(),
	price: integer('price').notNull(),
	qty: integer('qty').notNull(),
})

// ─── Настройки (key/value) — этап 1: доставка; форма в админке — этап 5 ─────

export const settings = pgTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Заделы этапов 9–11 (пустые таблицы) ─────────────────────────────────────

export const payments = pgTable('payments', {
	id: uuid('id').primaryKey().defaultRandom(),
	orderId: uuid('order_id')
		.notNull()
		.references(() => orders.id, { onDelete: 'cascade' }),
	amount: integer('amount').notNull(), // копейки
	status: text('status').notNull().default('created'),
	provider: text('provider').notNull().default('mock'),
	externalId: text('external_id'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/** Аутбокс уведомлений: строка пишется в транзакции события (§5.16) */
export const notifications = pgTable('notifications', {
	id: uuid('id').primaryKey().defaultRandom(),
	/** email | sms */
	channel: text('channel').notNull(),
	/** order.ready | otp.auth | promo.blast … */
	event: text('event').notNull(),
	payload: jsonb('payload').notNull(),
	status: text('status').notNull().default('pending'),
	error: text('error'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/** Ошибки/warn — структурные логи в БД, задел под Sentry (§5, этап 11) */
export const errorEvents = pgTable('error_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	/** error | warn */
	level: text('level').notNull(),
	message: text('message').notNull(),
	stack: text('stack'),
	context: jsonb('context'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Типы ────────────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect
export type Category = typeof categories.$inferSelect
export type Product = typeof products.$inferSelect
export type SetItem = typeof setItems.$inferSelect
export type Promotion = typeof promotions.$inferSelect
export type Cart = typeof carts.$inferSelect
export type CartItem = typeof cartItems.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type Setting = typeof settings.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type ErrorEvent = typeof errorEvents.$inferSelect
