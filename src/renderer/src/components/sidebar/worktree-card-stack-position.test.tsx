// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { GitHubPRStack } from '../../../../shared/github/pull-request-types'
import { WorktreeCardStackPosition } from './worktree-card-stack-position'

const stack: GitHubPRStack = { number: 3716, position: 2, size: 3, baseRefName: 'main' }

function renderPosition(enabled: boolean, prStack: GitHubPRStack | undefined) {
  return render(
    <TooltipProvider>
      <WorktreeCardStackPosition enabled={enabled} stack={prStack} />
    </TooltipProvider>
  )
}

const position = (container: HTMLElement) =>
  container.querySelector('[data-worktree-card-stack-position]')

describe('WorktreeCardStackPosition', () => {
  afterEach(cleanup)

  it("shows the PR's place in its stack", () => {
    const element = position(renderPosition(true, stack).container)
    expect(element).toHaveTextContent('2/3')
    expect(element).toHaveAccessibleName('Stack #3716, 2 of 3')
  })

  it('stays hidden for a PR outside a stack', () => {
    expect(position(renderPosition(true, undefined).container)).toBeNull()
  })

  it('stays hidden while the card option is off', () => {
    expect(position(renderPosition(false, stack).container)).toBeNull()
  })
})
