import { describe, expect, it, vi } from 'vitest'
import type { ClaudeWebReplayedKey } from '../../../../shared/claude-remote-session'

const observeWorkspaceIndexShortcutKey = vi.fn()
vi.mock('../sidebar/workspace-index-shortcut-hint', () => ({ observeWorkspaceIndexShortcutKey }))

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
})
