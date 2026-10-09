import { describe, expect, it, vi } from 'vitest'
import { handleClaudeWebWindowOpen } from './claude-web-external-links'

describe('handleClaudeWebWindowOpen', () => {
  it('opens a link the page opens in a new tab in the default browser', () => {
    const openExternal = vi.fn()
    const result = handleClaudeWebWindowOpen('https://linear.app/team/issue/E-5618', openExternal)
    expect(openExternal).toHaveBeenCalledWith('https://linear.app/team/issue/E-5618')
    expect(result).toEqual({ action: 'deny' })
  })

  it('never hands any other scheme to the OS', () => {
    const openExternal = vi.fn()
    expect(handleClaudeWebWindowOpen('file:///etc/passwd', openExternal)).toEqual({
      action: 'deny'
    })
    expect(handleClaudeWebWindowOpen('javascript:alert(1)', openExternal)).toEqual({
      action: 'deny'
    })
    expect(openExternal).not.toHaveBeenCalled()
  })
})
