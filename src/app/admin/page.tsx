import { redirect } from 'next/navigation'

/** Дашборда нет (Q2): корень /admin — сразу к рабочему разделу */
export default function AdminIndexPage() {
	redirect('/admin/orders')
}
