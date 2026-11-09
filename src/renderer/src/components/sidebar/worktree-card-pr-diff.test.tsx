// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorktreeCardPrDiff, type PrDiffStat } from './worktree-card-pr-diff'

function renderDiff(enabled: boolean, diff: PrDiffStat | undefined) {
  return render(
    <TooltipProvider>
      <WorktreeCardPrDiff enabled={enabled} diff={diff} />
    </TooltipProvider>
  )
}

const chip = (container: HTMLElement) => container.querySelector('[data-worktree-card-pr-diff]')

describe('WorktreeCardPrDiff', () => {
  afterEach(cleanup)

  it("shows the PR's added and removed line totals", () => {
    const element = chip(renderDiff(true, { additions: 1240, deletions: 37 }).container)
    expect(element).toHaveTextContent('+1,240−37')
    expect(element).toHaveAccessibleName('1,240 lines added, 37 lines removed')
  })

  it('shows a PR that only removes lines', () => {
    expect(chip(renderDiff(true, { additions: 0, deletions: 5 }).container)).toHaveTextContent(
      '+0−5'
    )
  })

  it('stays hidden until the PR totals are known', () => {
    expect(chip(renderDiff(true, undefined).container)).toBeNull()
  })

  it('stays hidden while the card option is off', () => {
    expect(chip(renderDiff(false, { additions: 3, deletions: 1 }).container)).toBeNull()
  })
})
