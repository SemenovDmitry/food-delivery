'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useOptimistic, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { SortableList } from '@/components/admin/sortable-list'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	createCategory,
	deleteCategory,
	reorderCategories,
	updateCategory,
} from '@/lib/actions/categories'
import { plural } from '@/lib/format'
import { type CategoryFormValues, categoryFormSchema } from '@/lib/schemas/category'
import type { AdminCategoryRow } from '@/queries/categories'

/**
 * Управление категориями (этап 5, Q17): DnD-сортировка (Q25, optimistic +
 * серверная нормализация позиций), create/edit через Dialog (RHF+zod),
 * удаление с гвардом «в категории N товаров». Пагинации нет (Q27) —
 * reorder требует весь список на экране.
 */
export function CategoriesAdmin({ categories }: { categories: AdminCategoryRow[] }) {
	const [confirmed, setConfirmed] = useState(categories)
	const [isPending, startTransition] = useTransition()
	const [optimistic, applyOrder] = useOptimistic(
		confirmed,
		(_current: AdminCategoryRow[], next: AdminCategoryRow[]) => next,
	)
	const [editing, setEditing] = useState<AdminCategoryRow | null>(null)
	const [creating, setCreating] = useState(false)
	const [deleting, setDeleting] = useState<AdminCategoryRow | null>(null)
	const confirmedRef = useRef(confirmed)
	confirmedRef.current = confirmed

	function handleReorder(next: AdminCategoryRow[]) {
		startTransition(async () => {
			applyOrder(next)
			const result = await reorderCategories(next.map((item) => item.id))
			if (result.data === null) {
				toast.error(result.error)
				return // useOptimistic откатится, confirmed не трогаем
			}
			setConfirmed(next)
			toast.success('Порядок сохранён')
		})
	}

	function handleDelete() {
		if (!deleting) return
		startTransition(async () => {
			const result = await deleteCategory(deleting.id)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			setConfirmed(confirmedRef.current.filter((item) => item.id !== deleting.id))
			toast.success('Категория удалена')
			setDeleting(null)
		})
	}

	return (
		<div className='space-y-3'>
			<div className='flex items-center justify-between'>
				<p className='text-sm text-muted-foreground'>
					{optimistic.length} {plural(optimistic.length, 'категория', 'категории', 'категорий')} ·
					порядок виден на главной (навигация и секции)
				</p>
				<Button onClick={() => setCreating(true)}>Добавить категорию</Button>
			</div>

			<SortableList
				items={optimistic}
				onReorder={handleReorder}
				ariaLabel='Категории каталога'
				renderItem={(category) => (
					<div className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-3'>
						<div className='min-w-0'>
							<p className='truncate text-sm font-medium'>{category.name}</p>
							<p className='font-mono text-xs text-muted-foreground'>
								#{category.slug} · {category.productCount}{' '}
								{plural(category.productCount, 'товар', 'товара', 'товаров')}
							</p>
						</div>
						<div className='ml-auto flex gap-2'>
							<Button
								variant='outline'
								size='sm'
								onClick={() => setEditing(category)}
								disabled={isPending}
							>
								Изменить
							</Button>
							<Button
								variant='destructive'
								size='sm'
								onClick={() => setDeleting(category)}
								disabled={isPending}
							>
								Удалить
							</Button>
						</div>
					</div>
				)}
			/>

			<CategoryDialog
				open={creating || editing !== null}
				category={editing}
				onOpenChange={(open) => {
					if (!open) {
						setCreating(false)
						setEditing(null)
					}
				}}
			/>

			<Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>Удалить категорию?</DialogTitle>
						<DialogDescription>
							«{deleting?.name}» ({deleting?.slug}) будет удалена безвозвратно. Товары внутри —
							причина отказа: категория с товарами не удаляется.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setDeleting(null)}>
							Вернуться
						</Button>
						<Button variant='destructive' onClick={handleDelete} disabled={isPending}>
							Удалить
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

function CategoryDialog({
	open,
	category,
	onOpenChange,
}: {
	open: boolean
	category: AdminCategoryRow | null
	onOpenChange: (open: boolean) => void
}) {
	const isEdit = category !== null
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<CategoryFormValues>({
		resolver: zodResolver(categoryFormSchema),
		mode: 'onTouched',
		defaultValues: { name: category?.name ?? '', slug: category?.slug ?? '' },
	})

	async function onSubmit(values: CategoryFormValues) {
		const result = isEdit ? await updateCategory(category.id, values) : await createCategory(values)
		if (result.data === null) {
			toast.error(result.error)
			return
		}
		toast.success(isEdit ? 'Категория обновлена' : 'Категория создана')
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-md'>
				<DialogHeader>
					<DialogTitle>{isEdit ? 'Изменить категорию' : 'Новая категория'}</DialogTitle>
					<DialogDescription>
						slug — латиницей: он становится якорем #slug в навигации главной
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className='space-y-4' noValidate>
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='category-name'>Название</Label>
						<Input
							id='category-name'
							placeholder='Пицца'
							aria-invalid={errors.name ? true : undefined}
							aria-describedby={errors.name ? 'category-name-error' : undefined}
							{...register('name')}
						/>
						{errors.name && (
							<p id='category-name-error' className='text-sm text-destructive'>
								{errors.name.message}
							</p>
						)}
					</div>
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='category-slug'>slug</Label>
						<Input
							id='category-slug'
							placeholder='pizza'
							className='font-mono'
							aria-invalid={errors.slug ? true : undefined}
							aria-describedby={errors.slug ? 'category-slug-error' : undefined}
							{...register('slug')}
						/>
						{errors.slug && (
							<p id='category-slug-error' className='text-sm text-destructive'>
								{errors.slug.message}
							</p>
						)}
					</div>
					<div className='flex justify-end gap-2'>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
							Отмена
						</Button>
						<Button type='submit' disabled={isSubmitting}>
							{isEdit ? 'Сохранить' : 'Создать'}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	)
}
