import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SortableList } from './sortable-list'

/**
 * Переиспользуемый sortable-список (этап 5, Q25): ручка grip слева. DnD
 * мышью (порог 6px) и клавиатурой (Space → стрелки → Space) — интеракция,
 * не сторифицируем; onReorder в стори — no-op.
 */
const meta = {
	title: 'Admin/SortableList',
	component: SortableList,
} satisfies Meta<typeof SortableList>
export default meta
type Story = StoryObj<typeof meta>

/** Категории сидера как демо-строки (Meta инстанциирует T = SortableItem,
 * данные строки живут в замыкании renderItem) */
export const List: Story = {
	args: {
		items: [{ id: 'pizza' }, { id: 'shawarma' }, { id: 'sets' }],
		ariaLabel: 'Порядок категорий',
		onReorder: () => {},
		renderItem: (item) => (
			<span className='block px-2 py-2 text-sm'>
				{(
					{
						pizza: 'Пицца',
						shawarma: 'Шаурма',
						sets: 'Сеты',
					} as Record<string, string>
				)[String(item.id)] ?? String(item.id)}
			</span>
		),
	},
}
