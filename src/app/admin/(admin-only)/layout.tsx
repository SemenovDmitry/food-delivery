import { Suspense } from 'react'
import { requireAdminOnly } from '@/lib/session'

/**
 * Admin-only секция (Q2): products/categories/promotions/users/settings.
 * manager проходит requireAdmin (общий layout), но здесь срезается тихим
 * redirect'ом на /admin/orders — без 403-страницы. Гвард и children — в ОДНОЙ
 * Suspense-границе: менеджерский children не рендерится раньше проверки.
 */
export default function AdminOnlyLayout({ children }: LayoutProps<'/admin'>) {
	return (
		<Suspense fallback={null}>
			<Guard>{children}</Guard>
		</Suspense>
	)
}

async function Guard({ children }: { children: React.ReactNode }) {
	await requireAdminOnly()
	return children
}
