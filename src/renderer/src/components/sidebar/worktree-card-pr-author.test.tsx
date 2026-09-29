// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { setPullRequestAuthors } from '../workspace-status-rules/pr-author-store'
import { WorktreeCardPrAuthor } from './worktree-card-pr-author'

function renderAvatar(enabled: boolean) {
  return render(
    <TooltipProvider>
      <WorktreeCardPrAuthor worktreeId="wt" enabled={enabled} />
    </TooltipProvider>
  )
}

const avatar = (container: HTMLElement) => container.querySelector('[data-worktree-card-pr-author]')

describe('WorktreeCardPrAuthor', () => {
  afterEach(() => {
    cleanup()
    setPullRequestAuthors(new Map())
  })

  it('shows the author once the pull request is known', () => {
    const { container } = renderAvatar(true)
    expect(avatar(container)).toBeNull()

    act(() => setPullRequestAuthors(new Map([['wt', 'madsenmm']])))
    expect(avatar(container)).toBeInTheDocument()
  })

  it('stays hidden while the card option is off', () => {
    setPullRequestAuthors(new Map([['wt', 'madsenmm']]))
    expect(avatar(renderAvatar(false).container)).toBeNull()
  })
})
