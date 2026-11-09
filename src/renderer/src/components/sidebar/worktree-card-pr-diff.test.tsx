// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { WorktreeCardDiff } from './worktree-card-diff-source'
import { WorktreeCardPrDiff } from './worktree-card-pr-diff'

function renderDiff(enabled: boolean, diff: WorktreeCardDiff | undefined) {
  return render(
    <TooltipProvider>
      <WorktreeCardPrDiff enabled={enabled} diff={diff} />
    </TooltipProvider>
  )
}

const chip = (container: HTMLElement) => container.querySelector('[data-worktree-card-pr-diff]')

describe('WorktreeCardPrDiff', () => {
  afterEach(cleanup)

  it("shows the worktree's local added and removed line totals", () => {
    const element = chip(
      renderDiff(true, { additions: 1240, deletions: 37, source: 'local' }).container
    )
    expect(element).toHaveTextContent('+1,240−37')
    expect(element).toHaveAccessibleName('Local changes: 1,240 lines added, 37 lines removed')
  })

  it('says when the totals come from the PR on GitHub', () => {
    const element = chip(
      renderDiff(true, { additions: 3, deletions: 1, source: 'github' }).container
    )
    expect(element).toHaveAccessibleName('Pull request on GitHub: 3 lines added, 1 lines removed')
  })

  it('shows a diff that only removes lines', () => {
    expect(
      chip(renderDiff(true, { additions: 0, deletions: 5, source: 'local' }).container)
    ).toHaveTextContent('+0−5')
  })

  it('stays hidden until a diff is known', () => {
    expect(chip(renderDiff(true, undefined).container)).toBeNull()
  })

  it('stays hidden while the card option is off', () => {
    expect(
      chip(renderDiff(false, { additions: 3, deletions: 1, source: 'local' }).container)
    ).toBeNull()
  })
})
