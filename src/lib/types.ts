/** Результат серверных действий: дискриминированный union (AGENTS.md §11) */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
