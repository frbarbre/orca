// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cloneDefaultWorkspaceStatuses } from '../../../../shared/workspace-statuses'
import { WorktreeCardWorkspaceStatus } from './worktree-card-workspace-status'

const statuses = cloneDefaultWorkspaceStatuses()

function renderStatus(enabled: boolean, status: string | undefined) {
  return render(
    <TooltipProvider>
      <WorktreeCardWorkspaceStatus
        enabled={enabled}
        worktree={{ workspaceStatus: status }}
        workspaceStatuses={statuses}
      />
    </TooltipProvider>
  )
}

const badge = (container: HTMLElement) =>
  container.querySelector('[data-worktree-card-workspace-status]')

describe('WorktreeCardWorkspaceStatus', () => {
  afterEach(cleanup)

  it("shows the workspace's status lane", () => {
    const target = statuses[1]
    const element = badge(renderStatus(true, target.id).container)
    expect(element).toHaveTextContent(target.label)
    expect(element).toHaveAttribute('data-worktree-card-workspace-status', target.id)
  })

  it('falls back to the default status for a workspace without one', () => {
    expect(badge(renderStatus(true, undefined).container)).toHaveTextContent('In progress')
  })

  it('stays hidden while the card option is off', () => {
    expect(badge(renderStatus(false, statuses[1].id).container)).toBeNull()
  })
})
