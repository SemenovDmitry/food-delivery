import type { Metadata } from 'next'
import Link from 'next/link'
import { PerPageSelect } from '@/components/admin/per-page-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { formatDateTime, formatDiscount, formatPrice } from '@/lib/format'
import { adminListHref, adminListParamsSchema } from '@/lib/schemas/admin-list'
import { getAllPromotions } from '@/queries/promotions'

export const metadata: Metadata = { title: 'Акции' }

const BASE = '/admin/promotions'

export default async function AdminPromotionsPage({
	searchParams,
}: PageProps<'/admin/promotions'>) {
	const sp = await searchParams
	const params = adminListParamsSchema.parse({ page: sp.page, perPage: sp.perPage })
	const { rows, total } = await getAllPromotions({ page: params.page, perPage: params.perPage })
	const totalPages = Math.max(1, Math.ceil(total / params.perPage))
	const page = Math.min(params.page, totalPages)

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<h2 className='text-xl font-semibold'>Акции</h2>
				<Button asChild>
					<Link href='/admin/promotions/new'>Добавить акцию</Link>
				</Button>
			</div>

			{rows.length === 0 ? (
				<p className='rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground'>
					Акций нет
				</p>
			) : (
				<div className='overflow-x-auto rounded-lg border'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Код</TableHead>
								<TableHead>Название</TableHead>
								<TableHead>Скидка</TableHead>
								<TableHead>Скоуп</TableHead>
								<TableHead className='text-right'>Условие</TableHead>
								<TableHead>Окно</TableHead>
								<TableHead>Флаги</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((promo) => (
								<TableRow key={promo.id}>
									<TableCell className='font-mono text-sm'>{promo.code ?? '—'}</TableCell>
									<TableCell className='text-sm'>{promo.name}</TableCell>
									<TableCell className='text-sm tabular-nums'>{formatDiscount(promo)}</TableCell>
									<TableCell className='text-sm'>{promo.categoryName ?? 'Весь заказ'}</TableCell>
									<TableCell className='text-right text-sm text-muted-foreground'>
										{promo.minTotal > 0 ? `от ${formatPrice(promo.minTotal)}` : '—'}
									</TableCell>
									<TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
										{promo.startsAt || promo.endsAt ? (
											<>
												{promo.startsAt ? formatDateTime(promo.startsAt) : '…'}
												{' — '}
												{promo.endsAt ? formatDateTime(promo.endsAt) : '…'}
											</>
										) : (
											'без окна'
										)}
									</TableCell>
									<TableCell>
										<div className='flex flex-wrap gap-1'>
											{promo.isActive ? (
												<Badge
													variant='outline'
													className='border-status-success/30 bg-status-success/10 text-status-success'
												>
													Активна
												</Badge>
											) : (
												<Badge variant='outline' className='text-muted-foreground'>
													Выключена
												</Badge>
											)}
											{promo.isPublic ? (
												<Badge
													variant='outline'
													className='border-status-info/30 bg-status-info/10 text-status-info'
												>
													Публичная
												</Badge>
											) : (
												<Badge variant='outline' className='text-muted-foreground'>
													Скрытая
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell>
										<Button variant='outline' size='sm' asChild>
											<Link href={`${BASE}/${promo.id}`}>Изменить</Link>
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<div className='flex flex-wrap items-center gap-2 text-sm'>
				<PerPageSelect base={BASE} perPage={params.perPage} />
				<nav aria-label='Страницы списка' className='ml-auto flex items-center gap-2'>
					{page > 1 ? (
						<Link
							className='rounded-md px-2 py-1 hover:bg-muted'
							href={adminListHref(BASE, { page: page - 1, perPage: params.perPage })}
						>
							← Назад
						</Link>
					) : (
						<span aria-disabled className='rounded-md px-2 py-1 text-muted-foreground/50'>
							← Назад
						</span>
					)}
					<span className='text-muted-foreground'>
						Всего {total} · страница {page} из {totalPages}
					</span>
					{page < totalPages ? (
						<Link
							className='rounded-md px-2 py-1 hover:bg-muted'
							href={adminListHref(BASE, { page: page + 1, perPage: params.perPage })}
						>
							Вперёд →
						</Link>
					) : (
						<span aria-disabled className='rounded-md px-2 py-1 text-muted-foreground/50'>
							Вперёд →
						</span>
					)}
				</nav>
			</div>
		</div>
	)
}
