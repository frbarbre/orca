// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cloneDefaultWorkspaceStatusRuleConfig,
  type WorkspaceStatusRuleConfig
} from '../../../../shared/workspace-status-rule-config'

const mocks = vi.hoisted(() => ({
  config: null as WorkspaceStatusRuleConfig | null,
  setWorkspaceStatusRules: vi.fn()
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      workspaceStatusRules: mocks.config,
      workspaceStatuses: [{ id: 'review', label: 'Review' }],
      repos: [],
      setWorkspaceStatusRules: mocks.setWorkspaceStatusRules
    })
}))
vi.mock('./WorkspaceActionPromptsSection', () => ({
  WorkspaceActionPromptsSection: () => null
}))

import { PullRequestStatusRulesSection } from './PullRequestStatusRulesSection'

describe('PR rules settings', () => {
  beforeEach(() => {
    mocks.config = { ...cloneDefaultWorkspaceStatusRuleConfig(), enabled: true }
    mocks.setWorkspaceStatusRules.mockReset()
  })

  afterEach(cleanup)

  it('opens on General, with a tab for every pull request state', () => {
    render(<PullRequestStatusRulesSection />)

    expect(screen.getByText('New workspaces start in')).toBeInTheDocument()
    for (const tab of ['Reviewing', 'Conflicts', 'Review', 'Merge gate', 'PM approval']) {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument()
    }
    expect(screen.queryByText('Resolve conflicts with an agent')).toBeNull()
  })

  it('shows a state’s own settings on its tab, beside its column', async () => {
    render(<PullRequestStatusRulesSection />)

    await userEvent.click(screen.getByRole('tab', { name: 'Conflicts' }))

    expect(screen.getByText('Has merge conflicts')).toBeInTheDocument()
    expect(screen.getByText('Resolve conflicts with an agent')).toBeInTheDocument()
    expect(screen.queryByText('New workspaces start in')).toBeNull()
    expect(screen.queryByText('Prompt for a first review')).toBeNull()
  })

  it('lets the reviewing view be picked', async () => {
    mocks.config = {
      ...mocks.config!,
      reviewInbox: { ...mocks.config!.reviewInbox, enabled: true }
    }
    render(<PullRequestStatusRulesSection />)

    await userEvent.click(screen.getByRole('tab', { name: 'Reviewing' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Terminal' }))

    expect(mocks.setWorkspaceStatusRules).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewInbox: expect.objectContaining({ view: 'terminal' })
      })
    )
  })
})
