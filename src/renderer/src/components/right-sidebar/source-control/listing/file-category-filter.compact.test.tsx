import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SourceControlFileCategoryFilter } from './file-category-filter'

function render(isCategoryFilterActive: boolean): string {
  return renderToStaticMarkup(
    <SourceControlFileCategoryFilter
      compact
      presentFileCategories={['implementation', 'test']}
      hiddenFileCategories={new Set(isCategoryFilterActive ? ['test'] : [])}
      isCategoryFilterActive={isCategoryFilterActive}
      onToggleFileCategory={vi.fn()}
    />
  )
}

describe('compact file type filter', () => {
  it('is an icon button that fits in a section header', () => {
    const markup = render(false)
    expect(markup).toContain('aria-label="Filter changed files by type"')
    expect(markup).not.toContain('>All file types<')
    expect(markup).toContain('title="All file types"')
    expect(markup).not.toContain('data-filter-active')
  })

  it('marks itself while some file types are hidden', () => {
    expect(render(true)).toContain('data-filter-active="true"')
  })

  it('names the shown file types in the header while filtering', () => {
    expect(render(true)).toContain('>Implementation</span>')
  })

  it('names a hidden area in the header, and lint baselines as a file type', () => {
    const markup = renderToStaticMarkup(
      <SourceControlFileCategoryFilter
        compact
        presentFileCategories={['implementation', 'lint-baseline', 'backend', 'frontend']}
        hiddenFileCategories={new Set(['lint-baseline', 'backend'])}
        isCategoryFilterActive
        onToggleFileCategory={vi.fn()}
      />
    )
    expect(markup).toContain('>Implementation · Frontend</span>')
  })
})
