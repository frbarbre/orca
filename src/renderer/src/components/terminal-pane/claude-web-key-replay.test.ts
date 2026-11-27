import { describe, expect, it, vi } from 'vitest'
import type { ClaudeWebReplayedKey } from '../../../../shared/claude-remote-session'

const observeWorkspaceIndexShortcutKey = vi.fn()
vi.mock('../sidebar/workspace-index-shortcut-hint', () => ({ observeWorkspaceIndexShortcutKey }))

const requestActiveTerminalPaneSplit = vi.fn()
vi.mock('@/components/tab-bar/request-active-terminal-pane-split', () => ({
  requestActiveTerminalPaneSplit
}))

const { replayClaudeWebKey } = await import('./claude-web-key-replay')

const metaDown: ClaudeWebReplayedKey = {
  type: 'keydown',
  key: 'Meta',
  code: 'MetaLeft',
  metaKey: true,
  ctrlKey: false,
  altKey: false,
  shiftKey: false
}

describe('replayClaudeWebKey', () => {
  it('hands an observed key to the workspace number hints without dispatching it', () => {
    const target = { dispatchEvent: vi.fn() }

    replayClaudeWebKey({ ...metaDown, observed: true }, target as unknown as EventTarget)

    expect(target.dispatchEvent).not.toHaveBeenCalled()
    expect(observeWorkspaceIndexShortcutKey).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keydown', key: 'Meta', metaKey: true })
    )
  })

  it('splits the tab of the focused Claude web view instead of dispatching a split key', () => {
    const target = { dispatchEvent: vi.fn() }
    const splitKey: ClaudeWebReplayedKey = { ...metaDown, key: 'd', code: 'KeyD' }

    replayClaudeWebKey({ ...splitKey, split: 'right' }, target as unknown as EventTarget, 'tab-1')
    replayClaudeWebKey(
      { ...splitKey, shiftKey: true, split: 'down' },
      target as unknown as EventTarget,
      'tab-1'
    )

    expect(target.dispatchEvent).not.toHaveBeenCalled()
    expect(requestActiveTerminalPaneSplit.mock.calls).toEqual([
      [{ tabId: 'tab-1', direction: 'vertical' }],
      [{ tabId: 'tab-1', direction: 'horizontal' }]
    ])
  })

  it('drops a split key when no Claude web view has focus', () => {
    requestActiveTerminalPaneSplit.mockClear()
    const target = { dispatchEvent: vi.fn() }

    replayClaudeWebKey(
      { ...metaDown, key: 'd', code: 'KeyD', split: 'right' },
      target as unknown as EventTarget,
      null
    )

    expect(target.dispatchEvent).not.toHaveBeenCalled()
    expect(requestActiveTerminalPaneSplit).not.toHaveBeenCalled()
  })
})
