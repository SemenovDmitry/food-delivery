'use client'

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from 'cn'
import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'

type SortableItem = { id: string | number }

/**
 * Переиспользуемый vertical sortable-список (этап 5, Q25): мышь (PointerSensor
 * с порогом активации 6px — клики по кнопкам строки не таскают) И клавиатура
 * (KeyboardSensor: Space на ручке → стрелки → Space) — a11y-чеклист §7.
 * Порядок отдаётся наверх через onReorder(items) — оптимистику делает владелец.
 */
export function SortableList<T extends SortableItem>({
	items,
	onReorder,
	renderItem,
	ariaLabel,
}: {
	items: T[]
	onReorder: (items: T[]) => void
	renderItem: (item: T) => ReactNode
	ariaLabel: string
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	)

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event
		if (!over || active.id === over.id) return
		const oldIndex = items.findIndex((item) => item.id === active.id)
		const newIndex = items.findIndex((item) => item.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return
		onReorder(arrayMove(items, oldIndex, newIndex))
	}

	return (
		<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
			<SortableContext items={items} strategy={verticalListSortingStrategy}>
				<ul className='space-y-2' aria-label={ariaLabel}>
					{items.map((item) => (
						<SortableRow key={String(item.id)} id={item.id}>
							{renderItem(item)}
						</SortableRow>
					))}
				</ul>
			</SortableContext>
		</DndContext>
	)
}

function SortableRow({ id, children }: { id: string | number; children: ReactNode }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id,
	})

	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				'flex items-center gap-1 rounded-lg border bg-card',
				isDragging && 'relative z-10 opacity-80 ring-2 ring-primary/50',
			)}
		>
			<button
				type='button'
				className='flex h-10 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing'
				aria-label='Захватить и перетащить (Space, затем стрелки)'
				{...attributes}
				{...listeners}
			>
				<GripVertical aria-hidden className='size-4' />
			</button>
			<div className='min-w-0 flex-1'>{children}</div>
		</li>
	)
}
