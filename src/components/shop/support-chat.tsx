'use client'

import { cn } from 'cn'
import { MessageCircle, SendIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet'
import { getChatUnread } from '@/lib/actions/chat'
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

const UNREAD_POLL_MS = 30_000
const RECONNECT_MAX_MS = 15_000
/** Флаг «чат открывали хотя бы раз» — поллинг бейджа стартует только после него (Q3) */
const STORAGE_FLAG = 'chat-used'
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001'

type InitResponse = {
	threadId: string
	messages: {
		id: number
		direction: 'customer' | 'operator'
		text: string
		createdAt: string
		senderId: string | null
	}[]
}

const ERROR_LABELS: Record<string, string> = {
	validation: 'Сообщение не прошло проверку',
	forbidden: 'Нет доступа к этому чату',
	banned: 'Аккаунт заблокирован',
	unavailable: 'Нет соединения — попробуйте позже',
}

/**
 * Плавающий чат поддержки (этап 6, Q13): кнопка справа внизу, панель — Sheet.
 * WS и история — только по клику (закрыли → disconnect); записи — вариант C:
 * send/read по WS через шлюз, HTTP-фолбэка нет (WS упал → инпут дизейблится).
 * Отправитель рендерит из эха — dedupe по id, echo может обогнать ack.
 */
export function SupportChat() {
	const [open, setOpen] = useState(false)
	const [messages, setMessages] = useState<ChatMessageItem[]>([])
	const [unread, setUnread] = useState(0)
	const [connected, setConnected] = useState(false)
	const [input, setInput] = useState('')
	const [announcement, setAnnouncement] = useState('')

	const threadIdRef = useRef<string | null>(null)
	const wsRef = useRef<WebSocket | null>(null)
	const openRef = useRef(false)
	const intentionalCloseRef = useRef(false)
	const reconnectAttemptRef = useRef(0)
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const logRef = useRef<HTMLDivElement | null>(null)

	// ── Серверные сообщения ──────────────────────────────────────────────────

	function handleServerMessage(server: ChatServerMessage): void {
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
				if (server.threadId !== threadIdRef.current) return
				setMessages((prev) => upsertMessage(prev, server.message))
				// Показано = прочитано (Q5): авто-read на живой приход
				if (server.message.direction === 'operator' && threadIdRef.current) {
					wsRef.current?.send(JSON.stringify({ type: 'read', threadId: threadIdRef.current }))
				}
				break
			}
		}
	}

	// ── WS ───────────────────────────────────────────────────────────────────

	function connectWs(): void {
		const existing = wsRef.current
		if (
			existing &&
			(existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
		) {
			return
		}
		intentionalCloseRef.current = false
		const ws = new WebSocket(WS_URL)
		wsRef.current = ws
		ws.onopen = () => {
			const wasReconnect = reconnectAttemptRef.current > 0
			reconnectAttemptRef.current = 0
			setConnected(true)
			setAnnouncement('Соединение установлено')
			const threadId = threadIdRef.current
			if (threadId) ws.send(JSON.stringify({ type: 'subscribe', threadId }))
			// хилит пробел истории за время обрыва (Б1 с приёмки: fetch — вне крит-пути
			// реконнекта, иначе зависший в фоне fetch умирает вместе с цепочкой)
			if (wasReconnect) void initChat(true)
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
			setAnnouncement('Соединение потеряно')
			wsRef.current = null
			if (intentionalCloseRef.current || !openRef.current) return
			// backoff-луп: чистый WS-реконнект, без fetch в крит-пути (Б1)
			const delay = Math.min(RECONNECT_MAX_MS, 1000 * 2 ** reconnectAttemptRef.current)
			reconnectAttemptRef.current += 1
			reconnectTimerRef.current = setTimeout(connectWs, delay)
		}
	}

	async function initChat(isReconnect: boolean): Promise<void> {
		try {
			const response = await fetch('/api/chat/init', { method: 'POST' })
			if (!response.ok) throw new Error(`init ${response.status}`)
			const data = (await response.json()) as InitResponse
			threadIdRef.current = data.threadId
			try {
				localStorage.setItem(STORAGE_FLAG, '1')
			} catch {
				// приватный режим — бейдж-поллинг просто не стартует
			}
			setMessages(data.messages.map(toChatMessageItem))
			setUnread(0)
			const ws = wsRef.current
			// connectWs зовётся только при ПЕРВОМ открытии (из onopen реконнекта
			// подписка уже ушла) — fetch никогда не должен быть в крит-пути лупа
			if (ws?.readyState !== WebSocket.OPEN && ws?.readyState !== WebSocket.CONNECTING) {
				connectWs()
			}
		} catch {
			if (!isReconnect) toast.error('Чат недоступен — попробуйте позже')
		}
	}

	// ── Открытие/закрытие ────────────────────────────────────────────────────

	function handleOpenChange(next: boolean): void {
		openRef.current = next
		setOpen(next)
		if (next) {
			void initChat(false) // свежая история + read + WS (reconnect-пробел heals)
		} else {
			// WS и история — только по клику: закрыли → disconnect (Q8/§6)
			intentionalCloseRef.current = true
			wsRef.current?.close()
			wsRef.current = null
			if (reconnectTimerRef.current) {
				clearTimeout(reconnectTimerRef.current)
				reconnectTimerRef.current = null
			}
			setConnected(false)
		}
	}

	function send(): void {
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
				direction: 'customer',
				text: parsed.data,
				createdAt: new Date().toISOString(),
				status: 'sending',
			},
		])
		setInput('')
		const ws = wsRef.current
		if (ws?.readyState === WebSocket.OPEN && threadIdRef.current) {
			ws.send(
				JSON.stringify({ type: 'send', threadId: threadIdRef.current, text: parsed.data, tempId }),
			)
		} else {
			// гонка: WS отвалился между рендером и сабмитом
			setMessages((prev) =>
				prev.map((item) => (item.tempId === tempId ? { ...item, status: 'failed' } : item)),
			)
			toast.error(ERROR_LABELS.unavailable)
		}
	}

	// ── Эффекты ──────────────────────────────────────────────────────────────

	// Поллинг бейджа: только после первого открытия чата (Q3); open → skip
	useEffect(() => {
		let used = false
		try {
			used = localStorage.getItem(STORAGE_FLAG) === '1'
		} catch {
			used = false
		}
		if (!used) return
		const timer = setInterval(() => {
			if (document.hidden || openRef.current) return
			void getChatUnread().then((count) => {
				if (!openRef.current) setUnread(count)
			})
		}, UNREAD_POLL_MS)
		return () => clearInterval(timer)
	}, [])

	// Лента — к последнему сообщению
	useEffect(() => {
		const log = logRef.current
		const last = messages.at(-1)
		if (log && last) log.scrollTop = log.scrollHeight
	}, [messages])

	// Размонтирование: без реконнекта
	useEffect(() => {
		return () => {
			intentionalCloseRef.current = true
			wsRef.current?.close()
			wsRef.current = null
			if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
		}
	}, [])

	return (
		<>
			<Button
				type='button'
				size='icon'
				className='fixed right-4 bottom-4 z-50 size-12 rounded-full shadow-lg'
				aria-label={unread > 0 ? `Поддержка — непрочитанных: ${unread}` : 'Открыть чат поддержки'}
				onClick={() => handleOpenChange(true)}
			>
				<MessageCircle className='size-5' aria-hidden />
				{unread > 0 && (
					<Badge
						className='pointer-events-none absolute -top-1 -right-1 rounded-full px-1.5'
						aria-hidden
					>
						{unread > 99 ? '99+' : unread}
					</Badge>
				)}
			</Button>

			<Sheet open={open} onOpenChange={handleOpenChange}>
				<SheetContent side='right' className='w-full gap-0 sm:max-w-sm'>
					<SheetHeader className='border-b'>
						<SheetTitle>Поддержка</SheetTitle>
						<SheetDescription>Ответим здесь же — обычно быстро</SheetDescription>
					</SheetHeader>

					<div
						ref={logRef}
						role='log'
						aria-live='polite'
						aria-label='Лента сообщений чата'
						className='flex-1 space-y-2 overflow-y-auto p-4'
					>
						{messages.length === 0 && (
							<p className='text-sm text-muted-foreground'>Напишите нам — ответим в этом чате.</p>
						)}
						{messages.map((item) => (
							<div
								key={item.key}
								className={cn(
									'flex',
									item.direction === 'customer' ? 'justify-end' : 'justify-start',
								)}
							>
								<div
									className={cn(
										'max-w-[85%] rounded-lg px-3 py-2 text-sm',
										item.direction === 'customer'
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
											item.direction === 'customer'
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
						className='flex gap-2 border-t p-4'
						onSubmit={(event) => {
							event.preventDefault()
							send()
						}}
					>
						<Input
							value={input}
							onChange={(event) => setInput(event.target.value)}
							placeholder={connected ? 'Сообщение…' : 'Нет соединения…'}
							aria-label='Сообщение оператору'
							maxLength={CHAT_TEXT_MAX}
							disabled={!connected}
							className='flex-1'
						/>
						<Button
							type='submit'
							size='icon'
							aria-label='Отправить сообщение'
							disabled={!connected || input.trim().length === 0}
						>
							<SendIcon aria-hidden />
						</Button>
					</form>
					<p aria-live='assertive' className='sr-only'>
						{announcement}
					</p>
				</SheetContent>
			</Sheet>
		</>
	)
}
