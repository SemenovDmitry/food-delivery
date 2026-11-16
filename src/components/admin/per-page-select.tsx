'use client'

import { useRouter } from 'next/navigation'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { PER_PAGE_OPTIONS, type PerPage } from '@/lib/schemas/admin-list'

/**
 * Селектор количества строк на странице (этап 5, Q19/Q27). useSearchParams не
 * читает (§5.30-семья): текущие параметры приходят пропсами с сервера, смена
 * пишет новый URL через router.push (page сбрасывается в 1).
 */
export function PerPageSelect({
	base,
	status,
	q,
	perPage,
}: {
	base: string
	status?: string
	q?: string
	perPage: PerPage
}) {
	const router = useRouter()

	function change(next: string) {
		const qs = new URLSearchParams()
		if (status) qs.set('status', status)
		if (q) qs.set('q', q)
		qs.set('page', '1')
		qs.set('perPage', next)
		router.push(`${base}?${qs.toString()}`)
	}

	return (
		<div className='ml-auto flex items-center gap-2 text-sm text-muted-foreground'>
			<span>На странице</span>
			<Select value={String(perPage)} onValueChange={change}>
				<SelectTrigger size='sm' aria-label='Количество строк на странице' className='w-20'>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{PER_PAGE_OPTIONS.map((option) => (
						<SelectItem key={option} value={String(option)}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}
