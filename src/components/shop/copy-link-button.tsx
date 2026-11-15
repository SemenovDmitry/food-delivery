'use client'

import { Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

/** «Скопировать ссылку отслеживания» — единственный доступ гостя к заказу (тикет 06) */
export function CopyLinkButton({ className }: { className?: string }) {
	return (
		<Button
			variant='outline'
			className={className}
			onClick={() => {
				navigator.clipboard
					.writeText(window.location.href)
					.then(() => toast.success('Ссылка скопирована'))
					.catch(() => toast.error('Не удалось скопировать — скопируйте адрес из строки браузера'))
			}}
		>
			<Link2 aria-hidden className='size-4' />
			Скопировать ссылку отслеживания
		</Button>
	)
}
