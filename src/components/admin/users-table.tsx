'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { archiveUser, banUser, unbanUser } from '@/lib/actions/users'
import { formatDate } from '@/lib/format'
import type { AdminUserRow } from '@/queries/users'

/**
 * Таблица пользователей (этап 5, Q12/Q24): роль — display-only (смены роли
 * НЕТ, Q12 — сотрудники только сидером); бан/архив с Dialog и self-guard'ом
 * на сервере. Архивированные скрыты на сервере (deleted_at IS NULL).
 */
export function UsersTable({
	rows,
	currentUserId,
}: {
	rows: AdminUserRow[]
	currentUserId: string
}) {
	const router = useRouter()
	const [isPending, startTransition] = useTransition()
	const [archiving, setArchiving] = useState<AdminUserRow | null>(null)

	function ban(row: AdminUserRow) {
		startTransition(async () => {
			const result = await banUser(row.id)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			toast.success(`${row.name} заблокирован`)
			router.refresh()
		})
	}

	function unban(row: AdminUserRow) {
		startTransition(async () => {
			const result = await unbanUser(row.id)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			toast.success(`${row.name} разблокирован`)
			router.refresh()
		})
	}

	function archive() {
		if (!archiving) return
		const row = archiving
		startTransition(async () => {
			const result = await archiveUser(row.id)
			if (result.data === null) {
				toast.error(result.error)
				return
			}
			toast.success(`${row.name} архивирован (заказы сохранены)`)
			setArchiving(null)
			router.refresh()
		})
	}

	if (rows.length === 0) {
		return (
			<p className='rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground'>
				Пользователи не найдены
			</p>
		)
	}

	return (
		<>
			<div className='overflow-x-auto rounded-lg border'>
				<table className='w-full text-sm'>
					<thead>
						<tr className='border-b bg-muted/50 text-left'>
							<th scope='col' className='px-3 py-2 font-medium'>
								Имя
							</th>
							<th scope='col' className='px-3 py-2 font-medium'>
								Телефон
							</th>
							<th scope='col' className='px-3 py-2 font-medium'>
								Email
							</th>
							<th scope='col' className='px-3 py-2 font-medium'>
								Роль
							</th>
							<th scope='col' className='px-3 py-2 font-medium'>
								Регистрация
							</th>
							<th scope='col' className='px-3 py-2 text-right font-medium'>
								Заказы
							</th>
							<th scope='col' className='px-3 py-2 font-medium'>
								Действия
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id} className='border-b last:border-b-0'>
								<td className='px-3 py-2'>
									{row.name}
									{row.bannedAt && (
										<Badge variant='destructive' className='ml-2'>
											Заблокирован
										</Badge>
									)}
								</td>
								<td className='px-3 py-2 whitespace-nowrap'>{row.phoneNumber ?? '—'}</td>
								<td className='px-3 py-2'>{row.email}</td>
								<td className='px-3 py-2'>
									<Badge variant='outline'>{row.role}</Badge>
								</td>
								<td className='px-3 py-2 whitespace-nowrap text-muted-foreground'>
									{formatDate(row.createdAt)}
								</td>
								<td className='px-3 py-2 text-right tabular-nums'>{row.orderCount}</td>
								<td className='px-3 py-2'>
									<div className='flex flex-wrap gap-1.5'>
										{row.bannedAt ? (
											<Button
												variant='outline'
												size='sm'
												disabled={isPending || row.id === currentUserId}
												onClick={() => unban(row)}
											>
												Разбанить
											</Button>
										) : (
											<Button
												variant='outline'
												size='sm'
												disabled={isPending || row.id === currentUserId}
												onClick={() => ban(row)}
											>
												Забанить
											</Button>
										)}
										<Button
											variant='destructive'
											size='sm'
											disabled={isPending || row.id === currentUserId}
											onClick={() => setArchiving(row)}
										>
											Архивировать
										</Button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<Dialog open={archiving !== null} onOpenChange={(open) => !open && setArchiving(null)}>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>Архивировать пользователя?</DialogTitle>
						<DialogDescription>
							«{archiving?.name}» ({archiving?.phoneNumber}) исчезнет из списков и не сможет войти.
							Его заказы останутся в истории с автором. Восстановление — только через БД (restore-UI
							нет, Q24).
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setArchiving(null)}>
							Вернуться
						</Button>
						<Button variant='destructive' onClick={archive} disabled={isPending}>
							Архивировать
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
