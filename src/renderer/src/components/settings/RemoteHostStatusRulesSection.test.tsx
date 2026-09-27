// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloneDefaultWorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'

type HostOption = { id: string; label: string; detail: string; kind: string }

const mocks = vi.hoisted(() => {
  const hostOptions: HostOption[] = []
  return { hostOptions }
})

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      workspaceStatusRules: {
        ...cloneDefaultWorkspaceStatusRuleConfig(),
        statusByHost: { 'runtime:helios': 'status-7' }
      },
      workspaceStatuses: [{ id: 'status-7', label: 'Helios' }],
      setWorkspaceStatusRules: vi.fn()
    })
}))

vi.mock('../sidebar/use-sidebar-host-scope-options', () => ({
  useSidebarHostScopeOptions: () => ({ hostOptions: mocks.hostOptions, hostScopeOptions: [] })
}))

import { RemoteHostStatusRulesSection } from './RemoteHostStatusRulesSection'

describe('RemoteHostStatusRulesSection', () => {
  afterEach(cleanup)

  it('renders nothing without a remote host', () => {
    mocks.hostOptions = [{ id: 'local', label: 'This Mac', detail: '', kind: 'local' }]
    const { container } = render(<RemoteHostStatusRulesSection />)

    expect(container).toBeEmptyDOMElement()
  })

  it('lists each remote host with the column it is mapped to', () => {
    mocks.hostOptions = [
      { id: 'local', label: 'This Mac', detail: '', kind: 'local' },
      { id: 'runtime:helios', label: 'Server Helios', detail: 'Orca server', kind: 'runtime' }
    ]
    render(<RemoteHostStatusRulesSection />)

    expect(screen.getByText('Server Helios')).toBeInTheDocument()
    expect(screen.queryByText('This Mac')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveTextContent('Helios')
  })
})
