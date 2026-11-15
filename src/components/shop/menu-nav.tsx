'use client'

import { useEffect, useState } from 'react'

type MenuNavProps = {
	categories: { slug: string; name: string }[]
	/** высота sticky-шапки навигации — учёт в scroll-margin секций */
}

/**
 * Sticky-навигация по категориям: нативные якорные ссылки (клавиатурность бесплатно),
 * scrollspy на IntersectionObserver (§8: подсветка активной секции).
 */
export function MenuNav({ categories }: MenuNavProps) {
	const [active, setActive] = useState<string>(categories[0]?.slug ?? '')

	useEffect(() => {
		const sections = categories
			.map((c) => document.getElementById(c.slug))
			.filter((el): el is HTMLElement => el !== null)

		if (sections.length === 0) return

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActive(entry.target.id)
					}
				}
			},
			// верхняя граница ниже sticky-блока, нижняя — верхняя треть экрана
			{ rootMargin: '-120px 0px -60% 0px', threshold: 0 },
		)

		for (const section of sections) {
			observer.observe(section)
		}
		return () => observer.disconnect()
	}, [categories])

	return (
		<nav aria-label='Категории меню' className='sticky top-14 z-30 bg-background/95 backdrop-blur'>
			<ul className='mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2'>
				{categories.map((category) => {
					const isActive = active === category.slug
					return (
						<li key={category.slug}>
							<a
								href={`#${category.slug}`}
								aria-current={isActive ? 'true' : undefined}
								className={`inline-block whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors ${
									isActive
										? 'border-primary bg-primary text-primary-foreground'
										: 'bg-background hover:bg-muted'
								}`}
							>
								{category.name}
							</a>
						</li>
					)
				})}
			</ul>
		</nav>
	)
}
