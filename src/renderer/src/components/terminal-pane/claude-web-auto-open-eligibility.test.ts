import { describe, expect, it } from 'vitest'
import { isTabInChatView } from './claude-web-auto-open-eligibility'

describe('isTabInChatView', () => {
  const tabsByWorktree = {
    wt: [
      { id: 'review', viewMode: 'chat' as const },
      { id: 'plain', viewMode: 'terminal' as const },
      { id: 'legacy' }
    ]
  }

  it('is true only for a tab set to Chat UI, which the web view must not cover', () => {
    expect(isTabInChatView(tabsByWorktree, 'review')).toBe(true)
    expect(isTabInChatView(tabsByWorktree, 'plain')).toBe(false)
    expect(isTabInChatView(tabsByWorktree, 'legacy')).toBe(false)
    expect(isTabInChatView(tabsByWorktree, 'missing')).toBe(false)
  })
})
