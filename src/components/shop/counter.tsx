import { cn } from 'cn'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MAX_QTY } from '@/lib/constants'

type CounterProps = {
	value: number
	onDecrease: () => void
	onIncrease: () => void
	/** aria-label уменьшения — контекстный («Убрать одну «Пепперони»») */
	decreaseLabel: string
	/** aria-label увеличения */
	increaseLabel: string
	/** блокирует обе кнопки (на время серверной мутации) */
	disabled?: boolean
	/** нижняя граница значения (по умолчанию 1) */
	min?: number
	/** верхняя граница значения (по умолчанию MAX_QTY) */
	max?: number
	/** компактный вариант (кнопки size-8, gap-1) — в строках корзины */
	size?: 'sm' | 'default'
	/** класс значения («tabular-nums» в корзине, «font-semibold» в товаре) */
	valueClassName?: string
	/** aria-live на значении — если степпер не внутри другой live-области */
	announceValue?: boolean
	className?: string
}

/**
 * Степпер количества [−][значение][+] — общий для строк корзины и деталей
 * товара (раньше дублировался дважды). Границы min/max дизейблят кнопки
 * сами — clamping в обработчиках не нужен.
 */
export function Counter({
	value,
	onDecrease,
	onIncrease,
	decreaseLabel,
	increaseLabel,
	disabled = false,
	min = 1,
	max = MAX_QTY,
	size = 'default',
	valueClassName,
	announceValue = false,
	className,
}: CounterProps) {
	const compact = size === 'sm'
	return (
		<div className={cn('flex items-center', compact ? 'gap-1' : 'gap-3', className)}>
			<Button
				variant='outline'
				size='icon'
				className={compact ? 'size-8' : undefined}
				aria-label={decreaseLabel}
				disabled={disabled || value <= min}
				onClick={onDecrease}
			>
				<Minus aria-hidden className='size-4' />
			</Button>
			<span
				aria-live={announceValue ? 'polite' : undefined}
				className={cn('w-8 text-center', valueClassName)}
			>
				{value}
			</span>
			<Button
				variant='outline'
				size='icon'
				className={compact ? 'size-8' : undefined}
				aria-label={increaseLabel}
				disabled={disabled || value >= max}
				onClick={onIncrease}
			>
				<Plus aria-hidden className='size-4' />
			</Button>
		</div>
	)
}
