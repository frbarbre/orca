// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorktreeCardLinearTitle } from './worktree-card-linear-title'

function renderTitle(enabled: boolean, title: string | null | undefined) {
  return render(
    <TooltipProvider>
      <WorktreeCardLinearTitle enabled={enabled} title={title} tooltipEnabled={false} />
    </TooltipProvider>
  )
}

describe('WorktreeCardLinearTitle', () => {
  afterEach(cleanup)

  it('shows the linked issue title when the option is on', () => {
    renderTitle(true, '  Frame picker: halve preview network requests ')
    expect(screen.getByText('Frame picker: halve preview network requests')).toBeInTheDocument()
  })

  it('renders nothing when the option is off or the issue has not loaded', () => {
    const off = renderTitle(false, 'Frame picker')
    expect(off.container.querySelector('[data-worktree-card-linear-title]')).toBeNull()
    cleanup()
    const loading = renderTitle(true, undefined)
    expect(loading.container.querySelector('[data-worktree-card-linear-title]')).toBeNull()
  })
})
