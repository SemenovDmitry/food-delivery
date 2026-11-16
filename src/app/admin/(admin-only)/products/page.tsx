import { cn } from 'cn'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PerPageSelect } from '@/components/admin/per-page-select'
import { ProductsReorder } from '@/components/admin/products-reorder'
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
import { formatPrice } from '@/lib/format'
import { adminListHref, adminListParamsSchema } from '@/lib/schemas/admin-list'
import { getCategoriesWithCounts } from '@/queries/categories'
import { getAdminProducts, getCategoryProducts } from '@/queries/products'

export const metadata: Metadata = { title: 'Товары' }

const BASE = '/admin/products'

/**
 * /admin/products (этап 5, Q16/Q26): без фильтра — таблица с пагинацией;
 * конкретная категория — режим DnD-порядка (весь список категории без
 * пагинации: позиции глобальны внутри категории, Q27).
 */
export default async function AdminProductsPage({ searchParams }: PageProps<'/admin/products'>) {
	const sp = await searchParams
	const params = adminListParamsSchema.parse({ page: sp.page, perPage: sp.perPage })
	const rawCategory = typeof sp.category === 'string' ? Number(sp.category) : NaN
	const categoryId = Number.isInteger(rawCategory) && rawCategory > 0 ? rawCategory : null
	const allCategories = await getCategoriesWithCounts()
	const activeCategory = categoryId ? allCategories.find((c) => c.id === categoryId) : null

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<h2 className='text-xl font-semibold'>Товары</h2>
				<Button asChild>
					<Link href='/admin/products/new'>Добавить товар</Link>
				</Button>
			</div>

			<div className='flex flex-wrap items-center gap-2'>
				<Chip
					label='Все категории'
					href={adminListHref(BASE, { page: 1, perPage: params.perPage })}
					active={categoryId === null}
				/>
				{allCategories.map((category) => (
					<Chip
						key={category.id}
						label={category.name}
						href={`${BASE}?category=${category.id}`}
						active={categoryId === category.id}
					/>
				))}
				{categoryId === null && <PerPageSelect base={BASE} perPage={params.perPage} />}
			</div>

			{activeCategory ? (
				// режим порядка: DnD по всей категории, пагинации нет
				<ProductsReorder
					categoryId={activeCategory.id}
					categoryName={activeCategory.name}
					items={await getCategoryProducts(activeCategory.id)}
				/>
			) : (
				<ProductsTable page={params.page} perPage={params.perPage} />
			)}
		</div>
	)
}

async function ProductsTable({ page, perPage }: { page: number; perPage: number }) {
	const { rows, total } = await getAdminProducts({ categoryId: null, page, perPage })
	const totalPages = Math.max(1, Math.ceil(total / perPage))
	const current = Math.min(page, totalPages)

	if (rows.length === 0) {
		return (
			<p className='rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground'>
				Товаров нет
			</p>
		)
	}

	return (
		<>
			<div className='overflow-x-auto rounded-lg border'>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Товар</TableHead>
							<TableHead>Категория</TableHead>
							<TableHead className='text-right'>Цена</TableHead>
							<TableHead>Тип</TableHead>
							<TableHead>Статус</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((product) => (
							<TableRow key={product.id}>
								<TableCell>
									<Link
										href={`/admin/products/${product.id}`}
										className='flex items-center gap-2 text-sm underline-offset-2 hover:underline'
									>
										<span aria-hidden className='text-lg'>
											{product.emoji}
										</span>
										<span className='font-medium'>{product.name}</span>
									</Link>
								</TableCell>
								<TableCell className='text-sm'>{product.categoryName}</TableCell>
								<TableCell className='text-right text-sm tabular-nums'>
									{formatPrice(product.price)}
								</TableCell>
								<TableCell>
									<Badge variant='outline'>{product.type === 'set' ? 'Сет' : 'Товар'}</Badge>
								</TableCell>
								<TableCell>
									{product.isActive ? (
										<Badge
											variant='outline'
											className='border-status-success/30 bg-status-success/10 text-status-success'
										>
											Активен
										</Badge>
									) : (
										<Badge variant='outline' className='text-muted-foreground'>
											Скрыт
										</Badge>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			<nav aria-label='Страницы списка' className='flex flex-wrap items-center gap-2 text-sm'>
				{current > 1 ? (
					<Link
						className='rounded-md px-2 py-1 hover:bg-muted'
						href={adminListHref(BASE, { page: current - 1, perPage })}
					>
						← Назад
					</Link>
				) : (
					<span aria-disabled className='rounded-md px-2 py-1 text-muted-foreground/50'>
						← Назад
					</span>
				)}
				<span className='text-muted-foreground'>
					Всего {total} · страница {current} из {totalPages}
				</span>
				{current < totalPages ? (
					<Link
						className='rounded-md px-2 py-1 hover:bg-muted'
						href={adminListHref(BASE, { page: current + 1, perPage })}
					>
						Вперёд →
					</Link>
				) : (
					<span aria-disabled className='rounded-md px-2 py-1 text-muted-foreground/50'>
						Вперёд →
					</span>
				)}
			</nav>
		</>
	)
}

function Chip({ label, href, active }: { label: string; href: string; active: boolean }) {
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
