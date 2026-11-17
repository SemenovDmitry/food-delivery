import { WebSocket } from 'ws'

import type { ChatIdentity, ChatServerMessage } from './protocol.js'

/** Соединение с идентичностью из upgrade-аутентификации */
export type GatewayConnection = {
	ws: WebSocket
	identity: ChatIdentity
	/** Тред, к которому подписано соединение (у клиента — один) */
	subscribedThread: string | null
	/** Результат join-валидации кешируется один раз на соединение (Q9) */
	validatedThreads: Set<string>
	/** Для ping/pong-свипа */
	alive: boolean
}

const connections = new Set<GatewayConnection>()
const threadRooms = new Map<string, Set<GatewayConnection>>()
const operators = new Set<GatewayConnection>()

export function addConnection(connection: GatewayConnection): void {
	connections.add(connection)
	connection.alive = true
}

export function removeConnection(connection: GatewayConnection): void {
	connections.delete(connection)
	operators.delete(connection)
	if (connection.subscribedThread) {
		threadRooms.get(connection.subscribedThread)?.delete(connection)
		connection.subscribedThread = null
	}
}

function leaveThread(connection: GatewayConnection): void {
	if (connection.subscribedThread) {
		threadRooms.get(connection.subscribedThread)?.delete(connection)
		connection.subscribedThread = null
	}
}

export function joinThread(connection: GatewayConnection, threadId: string): void {
	leaveThread(connection)
	let room = threadRooms.get(threadId)
	if (!room) {
		room = new Set()
		threadRooms.set(threadId, room)
	}
	room.add(connection)
	connection.subscribedThread = threadId
}

/** Комната operators — только операторские соединения (все треды сразу) */
export function joinOperators(connection: GatewayConnection): void {
	operators.add(connection)
}

export function sendJson(connection: GatewayConnection, message: ChatServerMessage): void {
	if (connection.ws.readyState === WebSocket.OPEN) {
		connection.ws.send(JSON.stringify(message))
	}
}

export function broadcastToThread(threadId: string, message: ChatServerMessage): void {
	for (const connection of threadRooms.get(threadId) ?? []) sendJson(connection, message)
}

export function broadcastToOperators(message: ChatServerMessage): void {
	for (const connection of operators) sendJson(connection, message)
}

/** Ping/pong 30 с (Q7): мёртвые соединения терминируются */
export function sweepConnections(pingIntervalMs: number): NodeJS.Timeout {
	return setInterval(() => {
		for (const connection of connections) {
			if (!connection.alive) {
				console.log(
					`[ws-gateway] sweep: terminate ${connection.identity.kind} (нет pong за ${pingIntervalMs}мс)`,
				)
				connection.ws.terminate()
				continue
			}
			connection.alive = false
			connection.ws.ping()
		}
	}, pingIntervalMs)
}
