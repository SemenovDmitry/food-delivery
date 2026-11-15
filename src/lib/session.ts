import { headers } from "next/headers";
import { auth } from "./auth";

/** Сессия текущего пользователя (или null для гостя) */
export async function getSession() {
  return await auth.api.getSession({ headers: await headers() });
}

/** Сессия с ролью admin|manager — гард закрытых зон /admin/* */
export async function getAdminSession() {
  const session = await getSession();
  if (!session) return null;
  const role = session.user.role;
  if (role !== "admin" && role !== "manager") return null;
  return session;
}
