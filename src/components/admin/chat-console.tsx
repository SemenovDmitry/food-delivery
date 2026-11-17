'use client'

import { cn } from 'cn'
import { MessageCircle, SendIcon } from 'lucide-react'
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getOperatorThreadsAction, getThreadMessages } from '@/lib/actions/chat'
import {
	type ChatMessageItem,
	failByTempId,
	promoteByTempId,
	toChatMessageItem,
	upsertMessage,
} from '@/lib/chat-client'
import { formatDateTime } from '@/lib/format'
import { CHAT_TEXT_MAX, chatMessageTextSchema } from '@/lib/schemas/chat'
import type { ChatServerMessage } from '@/lib/ws-protocol'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001'
const RECONNECT_MAX_MS = 10_000

export type OperatorThread = {
	id: string
	phone: string | null
	unread: number
}

const ERROR_LABELS: Record<string, string> = {
	validation: 'Сообщение не прошло проверку',
	forbidden: 'Нет доступа к этому чату',
	banned: 'Аккаунт заблокирован',
	unavailable: 'Нет соединения — попробуйте позже',
}

/**
 * Операторская консоль (этап 6, Q6): WS в комнате operators — новые треды
 * появляются табами сами (телефон из NOTIFY-payload или «unknown»), табы без
 * customer-сообщений не существуют вовсе (пустышки не доходят до фанаута).
 * Ответ из таба — тот же WS-релей, что и у виджета (вариант C). Клейма нет —
 * все операторы видят все треды.
 */
export function ChatConsole({ initialThreads }: { initialThreads: OperatorThread[] }) {
	const [threads, setThreads] = useState<OperatorThread[]>(initialThreads)
	const [activeId, setActiveId] = useState<string | null>(null)
	const [messages, setMessages] = useState<ChatMessageItem[]>([])
	const [connected, setConnected] = useState(false)
	const [input, setInput] = useState('')

	const wsRef = useRef<WebSocket | null>(null)
	const activeIdRef = useRef<string | null>(null)
	const attemptRef = useRef(0)
	const intentionalCloseRef = useRef(false)
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const logRef = useRef<HTMLDivElement | null>(null)

	/** Реконнект после обрыва: перечитать треды/unread (пропущенные NOTIFY) */
	const refreshThreads = useCallback(async (): Promise<void> => {
		const result = await getOperatorThreadsAction()
		if (result.data !== null) setThreads(result.data.threads)
	}, [])

	useEffect(() => {
		activeIdRef.current = activeId
	}, [activeId])

	// biome: функции в deps эффектов — только через useCallback (React Compiler не отменяет линт)
	const handleServerMessage = useCallback((server: ChatServerMessage): void => {
		switch (server.type) {
			case 'ack': {
				setMessages((prev) => promoteByTempId(prev, server.tempId, server.message))
				break
			}
			case 'error': {
				// narrowing не живёт в замыкании — фиксируем tempId в const
				const tempId = server.tempId
				if (tempId) {
					setMessages((prev) => failByTempId(prev, tempId))
				}
				toast.error(ERROR_LABELS[server.code] ?? 'Что-то пошло не так')
				break
			}
			case 'message': {
				const incoming = server.message
				setThreads((prev) => {
					const existingIdx = prev.findIndex((thread) => thread.id === server.threadId)
					const thread =
						existingIdx >= 0
							? prev[existingIdx]
							: { id: server.threadId, phone: server.phone, unread: 0 }
					// новый тред или свежее сообщение поднимают таб наверх (порядок по последнему сообщению)
					const rest = existingIdx >= 0 ? prev.filter((_, index) => index !== existingIdx) : prev
					const bumpUnread =
						incoming.direction === 'customer' && server.threadId !== activeIdRef.current
					return [{ ...thread, unread: bumpUnread ? thread.unread + 1 : thread.unread }, ...rest]
				})
				if (server.threadId === activeIdRef.current) {
					setMessages((prev) => upsertMessage(prev, incoming))
					// показано = прочитано (Q5): авто-read на живой приход
					if (incoming.direction === 'customer') {
						wsRef.current?.send(JSON.stringify({ type: 'read', threadId: server.threadId }))
					}
				}
				break
			}
		}
	}, [])

	const connectWs = useCallback((): void => {
		const existing = wsRef.current
		if (
			existing &&
			(existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
		) {
			return
		}
		const ws = new WebSocket(WS_URL)
		wsRef.current = ws
		ws.onopen = () => {
			const wasReconnect = attemptRef.current > 0
			attemptRef.current = 0
			setConnected(true)
			ws.send(JSON.stringify({ type: 'subscribe-operators' }))
			// пропущенные за оффлайн NOTIFY восстанавливаются перечитыванием (ревью 6)
			if (wasReconnect) void refreshThreads()
		}
		ws.onmessage = (event) => {
			try {
				handleServerMessage(JSON.parse(event.data as string) as ChatServerMessage)
			} catch {
				// битый кадр — пропускаем
			}
		}
		ws.onclose = () => {
			setConnected(false)
			wsRef.current = null
			// гард размонтирования: close приходит ПОСЛЕ очистки таймера в cleanup —
			// без него луп создаёт WebSocket на мёртвом компоненте (близнец-виджет
			// чинит это intentionalCloseRef, ревью этапа 6)
			if (intentionalCloseRef.current) return
			const delay = Math.min(RECONNECT_MAX_MS, 1000 * 2 ** attemptRef.current)
			attemptRef.current += 1
			reconnectTimerRef.current = setTimeout(connectWs, delay)
		}
	}, [handleServerMessage, refreshThreads])

	useEffect(() => {
		connectWs()
		return () => {
			intentionalCloseRef.current = true
			wsRef.current?.close()
			wsRef.current = null
			if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
		}
	}, [connectWs])

	// Лента — к последнему сообщению
	useEffect(() => {
		const log = logRef.current
		const last = messages.at(-1)
		if (log && last) log.scrollTop = log.scrollHeight
	}, [messages])

	async function openThread(threadId: string): Promise<void> {
		setActiveId(threadId)
		setMessages([])
		const result = await getThreadMessages(threadId)
		if (result.data === null) {
			toast.error(result.error)
			return
		}
		setMessages(result.data.messages.map(toChatMessageItem))
		// открыл = прочитал (Q5)
		setThreads((prev) =>
			prev.map((thread) => (thread.id === threadId ? { ...thread, unread: 0 } : thread)),
		)
		wsRef.current?.send(JSON.stringify({ type: 'read', threadId }))
	}

	function send(): void {
		if (!activeId) return
		const parsed = chatMessageTextSchema.safeParse(input)
		if (!parsed.success) {
			toast.error(parsed.error.issues[0]?.message ?? 'Введите сообщение')
			return
		}
		const tempId = crypto.randomUUID()
		setMessages((prev) => [
			...prev,
			{
				key: tempId,
				tempId,
				direction: 'operator',
				text: parsed.data,
				createdAt: new Date().toISOString(),
				status: 'sending',
			},
		])
		setInput('')
		const ws = wsRef.current
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'send', threadId: activeId, text: parsed.data, tempId }))
		} else {
			setMessages((prev) => failByTempId(prev, tempId))
			toast.error(ERROR_LABELS.unavailable)
		}
	}

	const activeThread = threads.find((thread) => thread.id === activeId) ?? null

	/** WAI-ARIA tabs: стрелки двигают фокус и открывают тред (§7) */
	function onTablistKeyDown(event: ReactKeyboardEvent): void {
		const target = event.target as HTMLElement
		if (target.getAttribute('role') !== 'tab') return
		const keys = { ArrowLeft: -1, ArrowRight: 1 } as const
		const delta = keys[event.key as keyof typeof keys]
		if (delta === undefined) return
		event.preventDefault()
		setThreads((prev) => {
			const currentIndex = prev.findIndex((thread) => thread.id === activeId)
			const base = currentIndex === -1 ? 0 : currentIndex + delta
			const next = prev[(base + prev.length) % prev.length]
			if (next) void openThread(next.id)
			return prev
		})
	}

	return (
		<div className='space-y-4'>
			{threads.length === 0 ? (
				<p className='rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground'>
					Обращений пока нет — таб появится с первым сообщением клиента
				</p>
			) : (
				<div
					role='tablist'
					aria-label='Треды чатов'
					className='flex gap-2 overflow-x-auto pb-1'
					onKeyDown={onTablistKeyDown}
				>
					{threads.map((thread) => (
						<button
							key={thread.id}
							type='button'
							role='tab'
							id={`chat-tab-${thread.id}`}
							aria-selected={thread.id === activeId}
							aria-controls={thread.id === activeId ? 'chat-thread-panel' : undefined}
							tabIndex={thread.id === activeId || activeId === null ? 0 : -1}
							onClick={() => void openThread(thread.id)}
							className={cn(
								'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
								thread.id === activeId
									? 'border-primary bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground',
							)}
						>
							{thread.phone ?? 'unknown'}
							{thread.unread > 0 && (
								<Badge
									className='rounded-full px-1.5'
									aria-label={`Непрочитанных: ${thread.unread}`}
								>
									{thread.unread > 99 ? '99+' : thread.unread}
								</Badge>
							)}
						</button>
					))}
				</div>
			)}

			{activeId && activeThread ? (
				<div className='rounded-lg border'>
					<div className='border-b px-4 py-2 text-sm font-medium'>
						<MessageCircle className='mr-1.5 inline size-4' aria-hidden />
						{activeThread.phone ?? 'unknown'}
					</div>
					<div
						ref={logRef}
						role='tabpanel'
						id='chat-thread-panel'
						aria-labelledby={`chat-tab-${activeId}`}
						aria-live='polite'
						aria-label='Лента сообщений треда'
						className='h-96 space-y-2 overflow-y-auto p-4'
					>
						{messages.map((item) => (
							<div
								key={item.key}
								className={cn(
									'flex',
									item.direction === 'customer' ? 'justify-start' : 'justify-end',
								)}
							>
								<div
									className={cn(
										'max-w-[85%] rounded-lg px-3 py-2 text-sm',
										item.direction === 'operator'
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-foreground',
										item.status === 'sending' && 'opacity-70',
										item.status === 'failed' && 'border border-destructive text-destructive',
									)}
								>
									<p className='whitespace-pre-wrap break-words'>{item.text}</p>
									<p
										className={cn(
											'mt-0.5 text-xs',
											item.direction === 'operator'
												? 'text-primary-foreground/70'
												: 'text-muted-foreground',
											item.status === 'failed' && 'text-destructive',
										)}
									>
										{item.status === 'sending'
											? 'Отправляется…'
											: item.status === 'failed'
												? 'Не отправлено'
												: formatDateTime(item.createdAt)}
									</p>
								</div>
							</div>
						))}
					</div>
					<form
						className='flex gap-2 border-t p-3'
						onSubmit={(event) => {
							event.preventDefault()
							send()
						}}
					>
						<Input
							value={input}
							onChange={(event) => setInput(event.target.value)}
							placeholder={connected ? 'Ответ…' : 'Нет соединения…'}
							aria-label='Ответ клиенту'
							maxLength={CHAT_TEXT_MAX}
							disabled={!connected}
							className='flex-1'
						/>
						<Button
							type='submit'
							size='icon'
							aria-label='Отправить ответ'
							disabled={!connected || !activeId || input.trim().length === 0}
						>
							<SendIcon aria-hidden />
						</Button>
					</form>
				</div>
			) : (
				threads.length > 0 && (
					<p className='text-sm text-muted-foreground'>
						Выберите таб, чтобы открыть диалог и ответить
					</p>
				)
			)}
		</div>
	)
}
