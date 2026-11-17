import { createServer } from 'node:http'

import postgres from 'postgres'
import { WebSocketServer } from 'ws'

import { authenticate, isAllowedOrigin } from './auth.js'
import { env } from './env.js'
import type {
	ChatClientMessage,
	ChatInternalRequest,
	ChatNotifyPayload,
	ChatServerMessage,
} from './protocol.js'
import { relayInternal } from './relay.js'
import {
	addConnection,
	broadcastToOperators,
	broadcastToThread,
	type GatewayConnection,
	joinOperators,
	joinThread,
	removeConnection,
	sendJson,
	sweepConnections,
} from './rooms.js'

const PING_INTERVAL_MS = 30_000

const wss = new WebSocketServer({ noServer: true })

// Обычный HTTP на :3001 — только 426; WS живёт на upgrade (§5.22)
const httpServer = createServer((_request, response) => {
	response.writeHead(426, { 'content-type': 'text/plain; charset=utf-8' })
	response.end('Upgrade Required')
})

httpServer.on('upgrade', async (request, socket, head) => {
	if (!isAllowedOrigin(request.headers.origin)) {
		socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
		socket.destroy()
		return
	}
	const identity = await authenticate(request.headers.cookie ?? '')
	if (!identity) {
		// «WS-upgrade без идентичности отклонён» — приёмочный критерий этапа 6
		console.log('[ws-gateway] upgrade отклонён: нет идентичности')
		socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
		socket.destroy()
		return
	}
	wss.handleUpgrade(request, socket, head, (ws) => {
		console.log(
			`[ws-gateway] upgrade ok: ${identity.kind}${identity.kind === 'guest' ? '' : ' ' + identity.userId}`,
		)
		const connection: GatewayConnection = {
			ws,
			identity,
			subscribedThread: null,
			validatedThreads: new Set(),
			alive: true,
		}
		addConnection(connection)
		wireConnection(connection)
	})
})

function wireConnection(connection: GatewayConnection): void {
	connection.ws.on('pong', () => {
		connection.alive = true
	})
	connection.ws.on('close', () => {
		console.log(`[ws-gateway] close: ${connection.identity.kind} отключился`)
		removeConnection(connection)
	})
	connection.ws.on('error', (error) => {
		console.error('[ws-gateway] соединение упало:', error)
	})
	connection.ws.on('message', (raw) => {
		void handleClientMessage(connection, raw.toString())
	})
}

async function handleClientMessage(connection: GatewayConnection, raw: string): Promise<void> {
	let parsed: ChatClientMessage | null = null
	try {
		parsed = JSON.parse(raw) as ChatClientMessage
	} catch {
		parsed = null
	}
	if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
		sendJson(connection, { type: 'error', code: 'validation' })
		return
	}

	switch (parsed.type) {
		case 'subscribe': {
			// Оператору чужие треды доступны по роли; клиент — только свой:
			// join-валидация через internal один раз на соединение (кеш, Q9)
			if (
				connection.identity.kind !== 'operator' &&
				!connection.validatedThreads.has(parsed.threadId)
			) {
				const result = await relayInternal({
					action: 'join',
					identity: connection.identity,
					threadId: parsed.threadId,
				})
				if (!result.body?.ok) {
					sendJson(connection, { type: 'error', code: result.body?.code ?? 'unavailable' })
					return
				}
				connection.validatedThreads.add(parsed.threadId)
			}
			joinThread(connection, parsed.threadId)
			break
		}
		case 'subscribe-operators': {
			if (connection.identity.kind !== 'operator') {
				sendJson(connection, { type: 'error', code: 'forbidden' })
				return
			}
			joinOperators(connection)
			break
		}
		case 'send': {
			const request: ChatInternalRequest = {
				action: 'send',
				identity: connection.identity,
				threadId: parsed.threadId,
				text: parsed.text,
			}
			const result = await relayInternal(request)
			const body = result.body
			if (body?.ok === true && body.message) {
				sendJson(connection, { type: 'ack', tempId: parsed.tempId, message: body.message })
			} else {
				const code = body && body.ok === false ? body.code : 'unavailable'
				sendJson(connection, { type: 'error', tempId: parsed.tempId, code })
			}
			break
		}
		case 'read': {
			// Read без ack — клиент не ждёт ответа (Q5: NOTIFY для прочтения не нужен)
			await relayInternal({
				action: 'read',
				identity: connection.identity,
				threadId: parsed.threadId,
			})
			break
		}
		default: {
			sendJson(connection, { type: 'error', code: 'validation' })
		}
	}
}

// Фанаут: Postgres NOTIFY → комнаты (§5.22). Отдельное соединение для LISTEN.
const sql = postgres(env.DATABASE_URL)
await sql.listen('chat', (payload) => {
	try {
		const parsed = JSON.parse(payload) as ChatNotifyPayload
		const message: ChatServerMessage = {
			type: 'message',
			threadId: parsed.threadId,
			phone: parsed.phone,
			message: parsed.message,
		}
		broadcastToThread(parsed.threadId, message)
		broadcastToOperators(message)
	} catch (error) {
		console.error('[ws-gateway] битый NOTIFY payload:', error)
	}
})

const sweeper = sweepConnections(PING_INTERVAL_MS)

httpServer.listen(env.PORT, () => {
	console.log(`[ws-gateway] слушает :${env.PORT} (internal: ${env.NEXT_INTERNAL_URL})`)
})

function shutdown(): void {
	clearInterval(sweeper)
	httpServer.close()
	void sql.end()
	process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
