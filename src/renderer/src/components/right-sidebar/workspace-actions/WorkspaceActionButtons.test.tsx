// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

const context = vi.hoisted(() => ({
  current: { action: 'enable-auto-merge', pr: { state: 'open', number: 3612 } } as Record<
    string,
    unknown
  >
}))
vi.mock('./workspace-action-context', () => ({
  selectWorkspaceActionContext: () => context.current
}))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: unknown) => unknown) => select({})
}))
vi.mock('./launch-workspace-action', () => ({
  launchWorkspaceAction: vi.fn(async () => undefined)
}))

import { WorkspaceNextActionButton, WorkspaceReviewButton } from './WorkspaceActionButtons'

afterEach(cleanup)

describe('top bar workspace actions', () => {
  it('shows the next action as a small button with its label written out', () => {
    render(
      <TooltipProvider>
        <WorkspaceNextActionButton />
      </TooltipProvider>
    )

    const button = screen.getByRole('button', { name: 'Enable auto-merge' })
    expect(button).toHaveTextContent('Enable auto-merge')
    expect(button).toHaveAttribute('data-size', 'xs')
  })

  it('keeps Review a small icon button', () => {
    render(
      <TooltipProvider>
        <WorkspaceReviewButton />
      </TooltipProvider>
    )

    const button = screen.getByRole('button', { name: 'Review' })
    expect(button).not.toHaveTextContent('Review')
    expect(button).toHaveAttribute('data-size', 'icon-xs')
  })

  it('shows no next action when there is none', () => {
    context.current = { action: null, pr: null }
    const { container } = render(
      <TooltipProvider>
        <WorkspaceNextActionButton />
      </TooltipProvider>
    )
    expect(container).toBeEmptyDOMElement()
  })
})
