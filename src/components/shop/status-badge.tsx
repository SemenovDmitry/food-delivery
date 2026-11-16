import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import type { OrderStatus } from '@/db/schema'
import { STATUS_LABELS } from '@/lib/format'
import { isOrderStatus } from '@/lib/order-timeline'

/**
 * Цветной статус заказа (этап 4-бис, 2026-11-16: цепочка шагов заменена бейджем).
 * Мягкие стили bg-X/10 text-X на токенах темы (--status-*, обе темы); отмены —
 * destructive. Текст статуса внутри бейджа — цвет не единственный носитель смысла (§7).
 */
const STATUS_CLASSES: Record<OrderStatus, string> = {
	created: 'border-status-info/30 bg-status-info/10 text-status-info',
	preparing: 'border-status-progress/30 bg-status-progress/10 text-status-progress',
	ready: 'border-status-success/30 bg-status-success/10 text-status-success',
	in_delivery: 'border-status-info/30 bg-status-info/10 text-status-info',
	delivered: 'border-status-success/30 bg-status-success/10 text-status-success',
	picked_up: 'border-status-success/30 bg-status-success/10 text-status-success',
	cancelled_by_customer: '',
	cancelled_by_vendor: '',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
	if (!isOrderStatus(status)) {
		// text-колонка: невалидное значение не маскируем кастомом (ревью S7)
		return (
			<Badge variant='outline' className={className}>
				{status}
			</Badge>
		)
	}
	const cancelled = status === 'cancelled_by_customer' || status === 'cancelled_by_vendor'
	return (
		<Badge
			variant={cancelled ? 'destructive' : 'outline'}
			className={cn(!cancelled && STATUS_CLASSES[status], className)}
		>
			{STATUS_LABELS[status]}
		</Badge>
	)
}
