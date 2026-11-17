import { z } from 'zod'

/** Максимальная длина сообщения (Q4): кап гарантирует NOTIFY-payload < 8 КБ (лимит Postgres) */
export const CHAT_TEXT_MAX = 2000

/**
 * Текст сообщения чата (GLOSSARY «Сообщение чата»): trim → 1..2000.
 * Единая истина для internal-роута (server-side) и клиентской валидации —
 * trim идемпотентен, двойного применения не бывает (§5.31 не касается:
 * RHF-формы у чата нет, zodResolver не парсит).
 */
export const chatMessageTextSchema = z
	.string()
	.trim()
	.min(1, 'Введите сообщение')
	.max(CHAT_TEXT_MAX, `Сообщение слишком длинное — до ${CHAT_TEXT_MAX} символов`)

export type ChatMessageText = z.infer<typeof chatMessageTextSchema>
