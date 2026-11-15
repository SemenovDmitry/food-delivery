/** Результат серверных действий: дискриминант — data/error (null-поля) */
export type ActionResult<T> = { data: T; error: null } | { data: null; error: string }
