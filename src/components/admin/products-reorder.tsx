'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SortableList } from '@/components/admin/sortable-list'
import { Badge } from '@/components/ui/badge'
import { reorderProducts } from '@/lib/actions/products'
import { formatPrice } from '@/lib/format'

type ReorderItem = {
	id: string
	name: string
	emoji: string
	price: number
	type: string
	isActive: boolean
}

/**
 * DnD-сортировка товаров внутри категории (этап 5, Q26): режим включается
 * чипом категории, показывает ВЕСЬ список категории без пагинации — позиции
 * глобальны внутри категории, reorder по странице сломал бы порядок (Q27).
 */
export function ProductsReorder({
	categoryId,
	categoryName,
	items,
}: {
	categoryId: number
	categoryName: string
	items: ReorderItem[]
}) {
	const [confirmed, setConfirmed] = useState(items)
	const [_isPending, startTransition] = useTransition()
	const [optimistic, applyOrder] = useOptimistic(
		confirmed,
		(_current: ReorderItem[], next: ReorderItem[]) => next,
	)

	function handleReorder(next: ReorderItem[]) {
		startTransition(async () => {
			applyOrder(next)
			const result = await reorderProducts(
				categoryId,
				next.map((item) => item.id),
			)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			setConfirmed(next)
			toast.success('Порядок товаров сохранён')
		})
	}

	return (
		<div className='space-y-3'>
			<p className='text-sm text-muted-foreground'>
				«{categoryName}»: перетащите товары — порядок увидит витрина. Скрытые товары участвуют в
				порядке, но из каталога не видны.
			</p>
			<SortableList
				items={optimistic}
				onReorder={handleReorder}
				ariaLabel={`Товары категории «${categoryName}»`}
				renderItem={(item) => (
					<div className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-3'>
						<span aria-hidden className='text-xl'>
							{item.emoji}
						</span>
						<Link
							href={`/admin/products/${item.id}`}
							className='truncate text-sm font-medium underline-offset-2 hover:underline'
						>
							{item.name}
						</Link>
						<span className='text-sm tabular-nums text-muted-foreground'>
							{formatPrice(item.price)}
						</span>
						{item.type === 'set' && <Badge variant='outline'>Сет</Badge>}
						{!item.isActive && (
							<Badge variant='outline' className='text-muted-foreground'>
								Скрыт
							</Badge>
						)}
					</div>
				)}
			/>
		</div>
	)
}
