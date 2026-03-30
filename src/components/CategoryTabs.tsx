import { categoryOptions } from '../data/components'
import type { CategoryId } from '../types'

type CategoryTabsProps = {
  activeCategory: CategoryId
  onChange: (category: CategoryId) => void
}

export function CategoryTabs({
  activeCategory,
  onChange,
}: CategoryTabsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2"
      role="tablist"
      aria-label="Component categories"
    >
      {categoryOptions.map((category) => {
        const isActive = category.id === activeCategory

        return (
          <button
            key={category.id}
            id={`tab-${category.id}`}
            type="button"
            role="tab"
            aria-controls="component-grid-panel"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(category.id)}
            className={[
              'inline-flex shrink-0 items-center rounded-full px-4 py-2.5 text-[0.78rem] font-medium tracking-[0.12em] uppercase transition',
              isActive
                ? 'bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] text-[var(--on-primary)] shadow-[0_18px_32px_rgba(0,0,0,0.08)]'
                : 'bg-[var(--surface-high)] text-[var(--secondary)] hover:bg-[var(--surface-highest)] hover:text-[var(--foreground)]',
            ].join(' ')}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}
