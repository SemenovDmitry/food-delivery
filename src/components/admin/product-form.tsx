'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Counter } from '@/components/shop/counter'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { removeProductImage, uploadProductImage } from '@/lib/actions/images'
import { createProduct, deleteProduct, updateProduct } from '@/lib/actions/products'
import {
	type ProductFormInput,
	type ProductFormValues,
	productFormSchema,
} from '@/lib/schemas/product'

export type FormCategory = { id: number; name: string }
export type FormProductOption = { id: string; name: string }
export type FormProduct = {
	id: string
	name: string
	description: string | null
	price: number // копейки
	type: 'single' | 'set'
	emoji: string
	categoryId: number
	isActive: boolean
	components: { productId: string; qty: number }[]
}

/**
 * Форма товара (этап 5, Q16): RHF+zod (паттерн CheckoutForm), цена в рублях
 * (transform ×100 в копейки делает схема), состав сета — useFieldArray
 * (Select товара + Counter qty), виден только при type=set.
 */
export function ProductForm({
	categories,
	productOptions,
	product,
	imageSrc = null,
}: {
	categories: FormCategory[]
	productOptions: FormProductOption[]
	product?: FormProduct | null
	/** полный URL текущего фото (строит imageUrlFor на сервере, Q7) */
	imageSrc?: string | null
}) {
	const router = useRouter()
	const isEdit = product != null
	const [currentSrc, setCurrentSrc] = useState<string | null>(imageSrc)
	const [isUploading, startUploading] = useTransition()
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [isDeleting, startDeleting] = useTransition()
	const {
		register,
		handleSubmit,
		watch,
		control,
		formState: { errors },
	} = useForm<ProductFormInput, unknown, ProductFormValues>({
		resolver: zodResolver(productFormSchema),
		mode: 'onTouched',
		defaultValues: {
			name: product?.name ?? '',
			description: product?.description ?? '',
			// input показывает рубли; схема трансформит в копейки
			priceRubles: product ? product.price / 100 : ('' as unknown as number),
			type: product?.type ?? 'single',
			emoji: product?.emoji ?? '🍽️',
			categoryId: product?.categoryId ?? ('' as unknown as number),
			isActive: product?.isActive ?? true,
			components: product?.components ?? [],
		},
	})
	const { fields, append, remove, update } = useFieldArray({ control, name: 'components' })
	const productType = watch('type')
	const watchedComponents = watch('components')
	const componentsError =
		errors.components?.root?.message ??
		(errors.components as { message?: string } | undefined)?.message

	async function onSubmit(values: ProductFormValues) {
		const result = isEdit ? await updateProduct(product.id, values) : await createProduct(values)
		if (result.data === null) {
			toast.error(result.error)
			return
		}
		toast.success(isEdit ? 'Товар сохранён' : 'Товар создан')
		router.push('/admin/products')
	}

	return (
		<>
			<Card>
				<CardContent>
					<form onSubmit={handleSubmit(onSubmit)} className='space-y-5' noValidate>
						<div className='grid gap-5 sm:grid-cols-2'>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='product-name'>Название</Label>
								<Input
									id='product-name'
									aria-invalid={errors.name ? true : undefined}
									aria-describedby={errors.name ? 'product-name-error' : undefined}
									{...register('name')}
								/>
								<FieldError id='product-name-error' message={errors.name?.message} />
							</div>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='product-price'>Цена, ₽</Label>
								<Input
									id='product-price'
									type='number'
									step='0.01'
									min='1'
									inputMode='decimal'
									aria-invalid={errors.priceRubles ? true : undefined}
									aria-describedby={errors.priceRubles ? 'product-price-error' : undefined}
									{...register('priceRubles')}
								/>
								<FieldError id='product-price-error' message={errors.priceRubles?.message} />
							</div>
							<Controller
								control={control}
								name='categoryId'
								render={({ field, fieldState }) => (
									<div className='flex flex-col gap-1.5'>
										<Label htmlFor='product-category'>Категория</Label>
										<Select
											value={field.value ? String(field.value) : ''}
											onValueChange={(v) => field.onChange(Number(v))}
										>
											<SelectTrigger
												id='product-category'
												aria-invalid={fieldState.error ? true : undefined}
											>
												<SelectValue placeholder='Выберите категорию' />
											</SelectTrigger>
											<SelectContent>
												{categories.map((category) => (
													<SelectItem key={category.id} value={String(category.id)}>
														{category.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FieldError message={fieldState.error?.message} />
									</div>
								)}
							/>
							<Controller
								control={control}
								name='type'
								render={({ field }) => (
									<div className='flex flex-col gap-1.5'>
										<Label htmlFor='product-type'>Тип</Label>
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger id='product-type'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='single'>Одиночный товар</SelectItem>
												<SelectItem value='set'>Сет</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							/>
							<div className='flex flex-col gap-1.5'>
								<Label htmlFor='product-emoji'>Emoji-фолбэк</Label>
								<Input
									id='product-emoji'
									className='w-24 text-lg'
									aria-invalid={errors.emoji ? true : undefined}
									aria-describedby={errors.emoji ? 'product-emoji-error' : undefined}
									{...register('emoji')}
								/>
								<FieldError id='product-emoji-error' message={errors.emoji?.message} />
							</div>
							<Controller
								control={control}
								name='isActive'
								render={({ field }) => (
									<div className='flex items-center gap-3 pt-6'>
										<Switch
											id='product-active'
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
										<Label htmlFor='product-active' className='text-sm font-normal'>
											Показывать в каталоге
										</Label>
									</div>
								)}
							/>
						</div>

						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='product-description'>Описание</Label>
							<Textarea id='product-description' rows={2} {...register('description')} />
							<FieldError message={errors.description?.message} />
						</div>

						{isEdit && (
							<fieldset className='space-y-3 rounded-lg border p-4'>
								<legend className='px-1 text-sm font-medium'>Фото</legend>
								{currentSrc ? (
									<Image
										src={currentSrc}
										alt='Фото товара'
										width={240}
										height={120}
										className='h-28 w-60 rounded-md object-cover'
									/>
								) : (
									<p className='text-sm text-muted-foreground'>
										Фото нет — витрина показывает emoji-фолбэк. Загрузите JPEG/PNG/WebP до 5 МБ
										(width → 800px, webp).
									</p>
								)}
								<div className='flex flex-wrap items-center gap-3'>
									{/* скрытый input + стилизованная кнопка: onChange сразу льёт в MinIO */}
									<label className='inline-flex cursor-pointer items-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary'>
										Выбрать файл…
										<input
											type='file'
											accept='image/jpeg,image/png,image/webp'
											className='sr-only'
											disabled={isUploading}
											onChange={(event) => {
												const file = event.target.files?.[0]
												event.target.value = '' // повторный выбор того же файла тоже сработает
												if (!file || !product) return
												const formData = new FormData()
												formData.set('file', file)
												startUploading(async () => {
													const result = await uploadProductImage(product.id, formData)
													if (result.data === null) {
														toast.error(result.error)
														return
													}
													setCurrentSrc(result.data.src)
													toast.success('Фото загружено')
												})
											}}
										/>
									</label>
									{currentSrc && (
										<Button
											type='button'
											variant='outline'
											size='sm'
											disabled={isUploading}
											onClick={() =>
												product &&
												startUploading(async () => {
													const result = await removeProductImage(product.id)
													if (result.data === null) {
														toast.error(result.error)
														return
													}
													setCurrentSrc(null)
													toast.success('Фото убрано')
												})
											}
										>
											Убрать фото
										</Button>
									)}
									{isUploading && <span className='text-sm text-muted-foreground'>Загрузка…</span>}
								</div>
							</fieldset>
						)}

						{productType === 'set' && (
							<fieldset className='space-y-2 rounded-lg border p-4'>
								<legend className='px-1 text-sm font-medium'>Состав сета</legend>
								{fields.length === 0 && (
									<p className='text-sm text-muted-foreground'>Позиций пока нет</p>
								)}
								{fields.map((field, index) => (
									<div key={field.id} className='flex flex-wrap items-center gap-2'>
										<div className='min-w-52 flex-1'>
											<Controller
												control={control}
												name={`components.${index}.productId`}
												render={({ field: selectField }) => (
													<Select value={selectField.value} onValueChange={selectField.onChange}>
														<SelectTrigger size='sm' aria-label={`Товар позиции ${index + 1}`}>
															<SelectValue placeholder='Выберите товар' />
														</SelectTrigger>
														<SelectContent>
															{productOptions.map((option) => (
																<SelectItem key={option.id} value={option.id}>
																	{option.name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												)}
											/>
										</div>
										<Controller
											control={control}
											name={`components.${index}.qty`}
											render={({ field: qtyField }) => {
												const qty = Number(qtyField.value) || 1
												return (
													<Counter
														size='sm'
														value={qty}
														min={1}
														max={20}
														decreaseLabel={`Убрать одну единицу позиции ${index + 1}`}
														increaseLabel={`Добавить одну единицу позиции ${index + 1}`}
														onDecrease={() =>
															update(index, {
																productId: watchedComponents[index]?.productId ?? '',
																qty: Math.max(1, qty - 1),
															})
														}
														onIncrease={() =>
															update(index, {
																productId: watchedComponents[index]?.productId ?? '',
																qty: Math.min(20, qty + 1),
															})
														}
													/>
												)
											}}
										/>
										<Button
											type='button'
											variant='ghost'
											size='sm'
											onClick={() => remove(index)}
											aria-label={`Убрать позицию ${index + 1}`}
										>
											✕
										</Button>
									</div>
								))}
								<Button
									type='button'
									variant='outline'
									size='sm'
									onClick={() => append({ productId: '', qty: 1 })}
								>
									Добавить позицию
								</Button>
								<FieldError message={componentsError} />
							</fieldset>
						)}

						<div className='flex items-center justify-between gap-2'>
							{isEdit ? (
								<Button type='button' variant='destructive' onClick={() => setDeleteOpen(true)}>
									Удалить товар
								</Button>
							) : (
								<span />
							)}
							<div className='flex gap-2'>
								<Button
									type='button'
									variant='outline'
									onClick={() => router.push('/admin/products')}
								>
									Отмена
								</Button>
								<Button type='submit'>{isEdit ? 'Сохранить' : 'Создать'}</Button>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>
			{/* удаление хард (Q16): корзины каскадом, заказы переживают (снапшот) */}
			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>Удалить товар?</DialogTitle>
						<DialogDescription>
							«{product?.name}» исчезнет из каталога и корзин навсегда. Прошлые заказы сохранят
							снапшот позиций. Товар, входящий в состав сетов, не удалится — сервер вернёт ошибку с
							числом сетов.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setDeleteOpen(false)}>
							Вернуться
						</Button>
						<Button
							variant='destructive'
							disabled={isDeleting}
							onClick={() =>
								product &&
								startDeleting(async () => {
									const result = await deleteProduct(product.id)
									if (result.data === null) {
										toast.error(result.error)
										setDeleteOpen(false)
										return
									}
									toast.success('Товар удалён')
									router.push('/admin/products')
								})
							}
						>
							Удалить
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

function FieldError({ id, message }: { id?: string; message?: string }) {
	if (!message) return null
	return (
		<p id={id} className='text-sm text-destructive'>
			{message}
		</p>
	)
}
