import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyAgentViewChoice } from './agent-view-choice'
import { claudeWebView } from './claude-web-view-state'

const LEAF = '11111111-1111-4111-8111-111111111111'

afterEach(() => {
  claudeWebView.hide('tab-1')
})

describe('applyAgentViewChoice', () => {
  it('choosing Chat UI over the web view removes the web view and turns chat on', () => {
    claudeWebView.show('tab-1', LEAF)
    const onToggleChat = vi.fn()

    applyAgentViewChoice({
      next: 'chat',
      tabId: 'tab-1',
      claudeLeafId: LEAF,
      isChat: false,
      onToggleChat
    })

    expect(claudeWebView.leafIdFor('tab-1')).toBeNull()
    expect(onToggleChat).toHaveBeenCalledOnce()
  })

  it('choosing Chat UI when chat is already under the web view only removes the web view', () => {
    claudeWebView.show('tab-1', LEAF)
    const onToggleChat = vi.fn()

    applyAgentViewChoice({
      next: 'chat',
      tabId: 'tab-1',
      claudeLeafId: LEAF,
      isChat: true,
      onToggleChat
    })

    expect(claudeWebView.leafIdFor('tab-1')).toBeNull()
    expect(onToggleChat).not.toHaveBeenCalled()
  })

  it('choosing Terminal removes the web view and turns chat off', () => {
    claudeWebView.show('tab-1', LEAF)
    const onToggleChat = vi.fn()

    applyAgentViewChoice({
      next: 'terminal',
      tabId: 'tab-1',
      claudeLeafId: LEAF,
      isChat: true,
      onToggleChat
    })

    expect(claudeWebView.leafIdFor('tab-1')).toBeNull()
    expect(onToggleChat).toHaveBeenCalledOnce()
  })

  it('choosing Claude web shows the Claude pane', () => {
    applyAgentViewChoice({ next: 'claude-web', tabId: 'tab-1', claudeLeafId: LEAF, isChat: false })
    expect(claudeWebView.leafIdFor('tab-1')).toBe(LEAF)
  })
})
