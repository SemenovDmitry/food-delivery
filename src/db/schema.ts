import {
	bigserial,
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
 * `cancelled_by_timeout` (этап 9, Q17) — истекло окно оплаты онлайн-заказа;
 * единственный писатель — система (TTL-гарды lib/payments, свип — автоджоба
 * этапа 10); админ для живого отказа использует cancelled_by_vendor.
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
	'cancelled_by_timeout',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_PAYMENT_STATUSES = ['pending', 'paid'] as const
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number]

/**
 * Способы оплаты (этап 9, Q16, GLOSSARY «Онлайн-оплата»): on_receipt — всегда
 * доступен; online — только при ≥1 активном провайдере (payment_methods),
 * кухня не стартует до оплаты, окно — PAYMENT_WINDOW_MINUTES.
 */
export const PAYMENT_METHODS = ['online', 'on_receipt'] as const
export type PaymentMethodKind = (typeof PAYMENT_METHODS)[number]

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
	/** Бан (этап 5, Q14): наказание — режет вход и guarded-запросы; независим от deleted_at */
	bannedAt: timestamp('banned_at'),
	/** Архив (этап 5, Q24): софт-удаление — скрыт из списков админки, заказы остаются атрибутированными */
	deletedAt: timestamp('deleted_at'),
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
	/** Порядок на витрине и в sticky-навигации (этап 5, Q17); пишется DnD-сортировкой в админке */
	position: integer('position').notNull().default(0),
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
	imageUrl: text('image_url'), // MinIO, этап 5 — хранится КЛЮЧ объекта, URL строит imageUrlFor() из env (Q7)
	/** Скрытие из каталога без удаления (этап 5, Q16): корзину не трогает */
	isActive: boolean('is_active').notNull().default(true),
	/** Порядок внутри категории (этап 5, Q26); новый товар = max+1 своей категории */
	position: integer('position').notNull().default(0),
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
	/** pending | paid — переворачивается webhook'ом (online) или при получении (on_receipt, этап 9 Q21) */
	paymentStatus: text('payment_status').notNull().default('pending'),
	/**
	 * Способ оплаты (этап 9, Q16): online | on_receipt. Онлайн-заказ не стартует
	 * кухней до оплаты; окно — PAYMENT_WINDOW_MINUTES, просрочка → cancelled_by_timeout.
	 */
	paymentMethod: text('payment_method').notNull().default('on_receipt'),
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

/**
 * История смен статусов (этап 4, гриллинг Q13/Q15a): строка пишется КАЖДОЙ
 * сменой статуса в той же транзакции — писатели: createOrder ('created'),
 * cancelOrder (этап 4), updateOrderStatus (этап 5), автоджоба (этап 10).
 * UI этапа 4 таблицу не читает — времена шагов таймлайна появятся в этапе 10.
 */
export const orderStatusEvents = pgTable('order_status_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	orderId: uuid('order_id')
		.notNull()
		.references(() => orders.id, { onDelete: 'cascade' }),
	status: text('status').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Чат поддержки (этап 6, WS — §5.22) ──────────────────────────────────────

/** Направление сообщения (GLOSSARY «Направление сообщения»): пишет клиент | отвечает оператор */
export const CHAT_DIRECTIONS = ['customer', 'operator'] as const
export type ChatDirection = (typeof CHAT_DIRECTIONS)[number]

/**
 * Один постоянный тред на идентичность (Q2, GLOSSARY «Тред поддержки»):
 * у юзера — по user_id, у гостя — по guest_token из httpOnly-куки `chat_token`.
 * Unique на nullable-колонках: множественные NULL в Postgres не конфликтуют.
 * Гостевой тред усыновляется при логине (UPDATE user_id), если своего ещё нет.
 */
export const chatThreads = pgTable(
	'chat_threads',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// text: ссылка на user.id (better-auth использует text-идентификаторы); cascade — тред не осиротеет
		userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
		guestToken: uuid('guest_token'),
		/** Непрочитанные: customer-сообщения после operator_last_read_at, симметрично для клиента */
		customerLastReadAt: timestamp('customer_last_read_at'),
		operatorLastReadAt: timestamp('operator_last_read_at'),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow(),
	},
	(table) => [
		unique('chat_threads_user_id_unique').on(table.userId),
		unique('chat_threads_guest_token_unique').on(table.guestToken),
	],
)

/**
 * Сообщения треда. id — bigserial: порядок отображения = id (uuid не нужен —
 * айдишники не попадают в URL, isUuid-гард не требуется). text — 1..2000
 * после trim, валидация zod-схемой lib/schemas/chat.ts; колонка без CHECK.
 */
export const chatMessages = pgTable('chat_messages', {
	id: bigserial('id', { mode: 'number' }).primaryKey(),
	threadId: uuid('thread_id')
		.notNull()
		.references(() => chatThreads.id, { onDelete: 'cascade' }),
	direction: text('direction').notNull(), // CHAT_DIRECTIONS
	senderId: text('sender_id').references(() => user.id, { onDelete: 'set null' }),
	text: text('text').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Настройки (key/value) — этап 1: доставка; форма в админке — этап 5 ─────

export const settings = pgTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ─── Оплата (этап 9) ─────────────────────────────────────────────────────────

/**
 * Провайдеры оплаты — банки-заглушки (GLOSSARY «Провайдер оплаты»):
 * то, что выбирает пользователь на странице оплаты и переключает админ
 * тумблерами /admin/payments. Реализация одна (MockProvider, env
 * PAYMENT_PROVIDER) — code оседает в payments.provider; реальный банк = новый
 * файл провайдера + фабрика по code, UI не трогается.
 */
export const paymentMethods = pgTable('payment_methods', {
	id: uuid('id').primaryKey().defaultRandom(),
	code: text('code').notNull().unique(), // sber | unionpay — id банка в payments.provider
	label: text('label').notNull(), // «Сбербанк», «UnionPay»
	/** Выключение последнего активного убирает «Онлайн-оплату» из чекаута (мягко, Q20) */
	isActive: boolean('is_active').notNull().default(true),
	position: integer('position').notNull().default(0),
	createdAt: timestamp('created_at').notNull().defaultNow(),
})

/**
 * Одна строка payment на заказ (Q2, unique) — повторная попытка переиспользует
 * её (новый externalId), история попыток не ведётся. provider — code банка из
 * payment_methods (до выбора банка — default 'mock'); externalId присваивает
 * провайдер при initiate/повторе.
 */
export const payments = pgTable(
	'payments',
	{
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
	},
	(table) => [unique('payments_order_id_unique').on(table.orderId)],
)

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
export type OrderStatusEvent = typeof orderStatusEvents.$inferSelect
export type ChatThread = typeof chatThreads.$inferSelect
export type ChatMessage = typeof chatMessages.$inferSelect
export type Setting = typeof settings.$inferSelect
export type PaymentMethod = typeof paymentMethods.$inferSelect
export type Payment = typeof payments.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type ErrorEvent = typeof errorEvents.$inferSelect
