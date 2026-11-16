import type { Metadata } from 'next'
import { PerPageSelect } from '@/components/admin/per-page-select'
import { UsersTable } from '@/components/admin/users-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminListHref, adminListParamsSchema } from '@/lib/schemas/admin-list'
import { requireAdminOnly } from '@/lib/session'
import { getUsersList } from '@/queries/users'

export const metadata: Metadata = { title: 'Пользователи' }

const BASE = '/admin/users'

export default async function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
	await requireAdminOnly() // users — admin-only (manager → /admin/orders)

	const sp = await searchParams
	const params = adminListParamsSchema.parse({ page: sp.page, perPage: sp.perPage })
	const q = typeof sp.q === 'string' ? sp.q : ''

	const { rows, total } = await getUsersList({ q, page: params.page, perPage: params.perPage })
	const totalPages = Math.max(1, Math.ceil(total / params.perPage))
	const page = Math.min(params.page, totalPages)
	const { userId } = await requireAdminOnly()

	return (
		<div className='space-y-4'>
			<h2 className='text-xl font-semibold'>Пользователи</h2>
			<p className='text-sm text-muted-foreground'>
				Роль меняется только в сидере (Q12): сотрудники заводятся сидером, клиенты регистрируются по
				телефону. Бан и архив — ниже.
			</p>

			{/* GET-форма: поиск в searchParams (§5.3-семья), рендер на сервере */}
			<form action={BASE} className='flex max-w-md gap-2'>
				{params.perPage !== 25 && <input type='hidden' name='perPage' value={params.perPage} />}
				<Input
					type='search'
					name='q'
					defaultValue={q}
					placeholder='email, телефон или имя'
					aria-label='Поиск пользователя'
				/>
				<Button type='submit' variant='outline'>
					Найти
				</Button>
			</form>

			<UsersTable rows={rows} currentUserId={userId} />

			<div className='flex flex-wrap items-center gap-2 text-sm'>
				<PerPageSelect base={BASE} q={q || undefined} perPage={params.perPage} />
				<nav aria-label='Страницы списка' className='ml-auto flex items-center gap-2'>
					{page > 1 ? (
						<a
							className='rounded-md px-2 py-1 hover:bg-muted'
							href={adminListHref(BASE, {
								q: q || undefined,
								page: page - 1,
								perPage: params.perPage,
							})}
						>
							← Назад
						</a>
					) : (
						<span aria-disabled className='rounded-md px-2 py-1 text-muted-foreground/50'>
							← Назад
						</span>
					)}
					<span className='text-muted-foreground'>
						Всего {total} · страница {page} из {totalPages}
					</span>
					{page < totalPages ? (
						<a
							className='rounded-md px-2 py-1 hover:bg-muted'
							href={adminListHref(BASE, {
								q: q || undefined,
								page: page + 1,
								perPage: params.perPage,
							})}
						>
							Вперёд →
						</a>
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
