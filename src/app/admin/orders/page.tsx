import { cn } from 'cn'
import type { Metadata } from 'next'
import Link from 'next/link'
import { OrderStatusCell } from '@/components/admin/order-status-cell'
import { PerPageSelect } from '@/components/admin/per-page-select'
import { Badge } from '@/components/ui/badge'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import type { OrderStatus } from '@/db/schema'
import { ORDER_STATUSES } from '@/db/schema'
import { formatDateTime, formatPrice, STATUS_LABELS } from '@/lib/format'
import { adminListHref, adminListParamsSchema, type PerPage } from '@/lib/schemas/admin-list'
import { getAdminOrders } from '@/queries/orders'

export const metadata: Metadata = { title: 'Заказы' }

const BASE = '/admin/orders'

/** Групповые фильтры + каждый статус отдельным чипом (этап 5, Q10) */
const GROUP_FILTERS = [
	{ value: 'all', label: 'Все' },
	{ value: 'active', label: 'Активные' },
	{ value: 'terminal', label: 'Завершённые' },
] as const

export default async function AdminOrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
	const sp = await searchParams
	const params = adminListParamsSchema.parse({ page: sp.page, perPage: sp.perPage })
	const status = typeof sp.status === 'string' ? sp.status : 'all'

	const { rows, total } = await getAdminOrders({
		filter: status,
		page: params.page,
		perPage: params.perPage,
	})
	const totalPages = Math.max(1, Math.ceil(total / params.perPage))
	const page = Math.min(params.page, totalPages)

	return (
		<div className='space-y-4'>
			<h2 className='text-xl font-semibold'>Заказы</h2>

			<div className='flex flex-wrap items-center gap-x-2 gap-y-2'>
				{GROUP_FILTERS.map((filter) => (
					<FilterChip
						key={filter.value}
						label={filter.label}
						href={adminListHref(BASE, { status: filter.value, page: 1, perPage: params.perPage })}
						active={status === filter.value}
					/>
				))}
				{ORDER_STATUSES.map((orderStatus) => (
					<FilterChip
						key={orderStatus}
						label={STATUS_LABELS[orderStatus]}
						href={adminListHref(BASE, { status: orderStatus, page: 1, perPage: params.perPage })}
						active={status === orderStatus}
					/>
				))}
				<PerPageSelect base={BASE} status={status} perPage={params.perPage} />
			</div>

			{rows.length === 0 ? (
				<p className='rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground'>
					Заказов нет
				</p>
			) : (
				<div className='overflow-x-auto rounded-lg border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>№</TableHead>
								<TableHead>Создан</TableHead>
								<TableHead>Клиент</TableHead>
								<TableHead>Тип</TableHead>
								<TableHead className='text-right'>Состав</TableHead>
								<TableHead>Оплата</TableHead>
								<TableHead>Статус</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map(({ order, itemCount, total: orderTotal }) => (
								<TableRow key={order.id}>
									<TableCell>
										<Link
											href={`/orders/${order.id}`}
											className='font-mono text-sm underline-offset-2 hover:underline'
											title='Открыть квитанцию'
										>
											№ {order.id.slice(0, 8)}
										</Link>
									</TableCell>
									<TableCell className='whitespace-nowrap text-sm'>
										{formatDateTime(order.createdAt)}
									</TableCell>
									<TableCell className='text-sm'>
										<span className='block'>{order.customerName}</span>
										<span className='block text-muted-foreground'>{order.phone}</span>
									</TableCell>
									<TableCell className='text-sm'>
										{order.fulfillment === 'pickup' ? 'Самовывоз' : 'Доставка'}
									</TableCell>
									<TableCell className='text-right text-sm tabular-nums'>
										{itemCount} шт · <span className='font-medium'>{formatPrice(orderTotal)}</span>
									</TableCell>
									<TableCell>
										<PaymentBadge paid={order.paymentStatus === 'paid'} />
									</TableCell>
									<TableCell>
										<OrderStatusCell
											orderId={order.id}
											status={order.status as OrderStatus}
											fulfillment={order.fulfillment === 'pickup' ? 'pickup' : 'delivery'}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<Pager
				status={status}
				page={page}
				totalPages={totalPages}
				total={total}
				perPage={params.perPage}
			/>
		</div>
	)
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
	return (
		<Link
			href={href}
			aria-current={active ? 'true' : undefined}
			className={cn(
				'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
				active
					? 'border-primary bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground',
			)}
		>
			{label}
		</Link>
	)
}

/** Оплата — бейдж read-only: переворот делает webhook этапа 9 (Q10) */
function PaymentBadge({ paid }: { paid: boolean }) {
	return (
		<Badge
			variant='outline'
			className={
				paid ? 'border-status-success/30 bg-status-success/10 text-status-success' : undefined
			}
		>
			{paid ? 'Оплачен' : 'Ожидает'}
		</Badge>
	)
}

function Pager({
	status,
	page,
	totalPages,
	total,
	perPage,
}: {
	status: string
	page: number
	totalPages: number
	total: number
	perPage: PerPage
}) {
	const prev = page > 1 ? adminListHref(BASE, { status, page: page - 1, perPage }) : null
	const next = page < totalPages ? adminListHref(BASE, { status, page: page + 1, perPage }) : null
	// окно номеров: до 7 страниц вокруг текущей
	const windowStart = Math.max(1, Math.min(page - 3, totalPages - 6))
	const windowPages = Array.from({ length: Math.min(7, totalPages) }, (_, i) => windowStart + i)

	return (
		<nav aria-label='Страницы списка' className='flex flex-wrap items-center gap-2 text-sm'>
			<PagerLink href={prev} label='← Назад' disabled={!prev} />
			{windowPages.map((p) => (
				<FilterChip
					key={p}
					label={String(p)}
					href={adminListHref(BASE, { status, page: p, perPage })}
					active={p === page}
				/>
			))}
			<PagerLink href={next} label='Вперёд →' disabled={!next} />
			<span className='ml-auto text-muted-foreground'>
				Всего {total} · страница {page} из {totalPages}
			</span>
		</nav>
	)
}

function PagerLink({
	href,
	label,
	disabled,
}: {
	href: string | null
	label: string
	disabled: boolean
}) {
	if (disabled) {
		return (
			<span aria-disabled className='rounded-md px-2 py-1 text-muted-foreground/50'>
				{label}
			</span>
		)
	}
	return (
		<Link href={href ?? '#'} className='rounded-md px-2 py-1 hover:bg-muted'>
			{label}
		</Link>
	)
}
