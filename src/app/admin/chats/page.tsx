import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'

import { ChatConsole } from '@/components/admin/chat-console'
import { getOperatorThreads } from '@/lib/chat'

export const metadata: Metadata = { title: 'Чаты' }

/**
 * Операторская (этап 6, Q6): admin+manager — рядом с заказами, вне
 * admin-only зоны (гард в layout'е админки). §5.33: uncached-запрос списка
 * тредов исполняется на пререндере build → connection() до запроса, всё
 * динамическое — внутри Suspense.
 */
export default function AdminChatsPage() {
	return (
		<div className='space-y-4'>
			<h2 className='text-xl font-semibold'>Чаты</h2>
			<Suspense fallback={<p className='text-sm text-muted-foreground'>Загрузка тредов…</p>}>
				<ChatsSection />
			</Suspense>
		</div>
	)
}

async function ChatsSection() {
	await connection()
	const threads = await getOperatorThreads()
	return (
		<ChatConsole
			initialThreads={threads.map((thread) => ({
				id: thread.id,
				phone: thread.phone,
				unread: thread.unread,
			}))}
		/>
	)
}
