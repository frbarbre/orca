// @vitest-environment happy-dom
import type React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotesSendAgentTarget } from '@/lib/notes-send-agent-targets'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ReviewNotesSendMenuContent } from './ReviewNotesSendMenuContent'

const harness = vi.hoisted(() => {
  const state: Record<string, unknown> = {}
  const targets: NotesSendAgentTarget[] = []
  return { state, targets, sendMessageToAgent: vi.fn() }
})

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(harness.state),
    { getState: () => harness.state }
  )
}))
vi.mock('zustand/react/shallow', () => ({ useShallow: (selector: unknown) => selector }))
vi.mock('@/lib/notes-send-agent-targets', () => ({
  deriveNotesSendAgentTargets: () => harness.targets
}))
vi.mock('@/lib/agent-message-send', () => ({ sendMessageToAgent: harness.sendMessageToAgent }))
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }))
vi.mock('@/hooks/use-now', () => ({ useNow: () => 1_000 }))
vi.mock('@/components/sidebar/useWorktreeAgentRows', () => ({ useWorktreeAgentRows: () => [] }))
vi.mock('@/components/tab-bar/QuickLaunchButton', () => ({ QuickLaunchAgentMenuItems: () => null }))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenuItem: ({
    children,
    disabled,
    onSelect
  }: {
    children: React.ReactNode
    disabled?: boolean
    onSelect?: () => void
  }) => (
    <button type="button" role="menuitem" disabled={disabled} onClick={onSelect}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />
}))

function terminalTarget(tabId: string, agentType: 'claude' | 'codex'): NotesSendAgentTarget {
  return {
    paneKey: `${tabId}:leaf`,
    tabId,
    messageTarget: { kind: 'terminal', tabId, leafId: 'leaf' },
    agentType,
    tabTitle: tabId,
    status: 'eligible'
  }
}

function status(updatedAt: number) {
  return {
    state: 'done',
    prompt: '',
    updatedAt,
    stateStartedAt: updatedAt,
    paneKey: '',
    stateHistory: []
  }
}

describe('ReviewNotesSendMenuContent auto-picked target', () => {
  beforeEach(() => {
    harness.sendMessageToAgent.mockReset()
    harness.sendMessageToAgent.mockResolvedValue({ status: 'sent' })
    harness.targets = [terminalTarget('term-a', 'claude'), terminalTarget('term-b', 'codex')]
    // Tab B is open in the only window; tab A was active more recently but sits behind it.
    harness.state = {
      agentStatusByPaneKey: { 'term-a:leaf': status(900), 'term-b:leaf': status(100) },
      agentStatusEpoch: 0,
      tabsByWorktree: {},
      unifiedTabsByWorktree: {
        'wt-1': [
          { id: 'u-a', entityId: 'term-a', groupId: 'g-1', contentType: 'terminal' },
          { id: 'u-b', entityId: 'term-b', groupId: 'g-1', contentType: 'terminal' }
        ]
      },
      groupsByWorktree: { 'wt-1': [{ id: 'g-1', activeTabId: 'u-b' }] },
      layoutByWorktree: { 'wt-1': { type: 'leaf', groupId: 'g-1' } },
      terminalLayoutsByTabId: {},
      ptyIdsByTabId: {},
      runtimePaneTitlesByTabId: {}
    }
  })

  afterEach(() => {
    cleanup()
  })

  function renderMenu(): void {
    render(
      <TooltipProvider>
        <ReviewNotesSendMenuContent worktreeId="wt-1" groupId="g-1" prompt="my notes" />
      </TooltipProvider>
    )
  }

  it('comes first, names the picked session, and sends to it', async () => {
    renderMenu()
    const first = screen.getAllByRole('menuitem')[0]
    expect(first.textContent).toContain('Auto-picked')
    expect(first.textContent).toContain('Codex')

    fireEvent.click(first)
    await vi.waitFor(() =>
      expect(harness.sendMessageToAgent).toHaveBeenCalledWith({
        worktreeId: 'wt-1',
        prompt: 'my notes',
        target: { kind: 'terminal', tabId: 'term-b', leafId: 'leaf' }
      })
    )
  })

  it('is absent when no session can take notes', () => {
    harness.targets = harness.targets.map((target) => ({
      ...target,
      status: 'disabled' as const,
      disabledReason: 'Waiting for permission'
    }))
    renderMenu()
    expect(screen.queryByText('Auto-picked')).toBeNull()
  })
})
