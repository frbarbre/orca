import { beforeEach, describe, expect, it } from 'vitest'
import {
  claudeWebPreferenceForTab,
  preferClaudeWebForTab,
  resetClaudeWebTabPreferencesForTests
} from './claude-web-tab-preference'

describe('a per-tab Claude web preference', () => {
  beforeEach(() => resetClaudeWebTabPreferencesForTests())

  it('is unset until a launcher chooses one', () => {
    expect(claudeWebPreferenceForTab('tab-1')).toBeNull()
  })

  it('remembers whether the tab should open in the web view', () => {
    preferClaudeWebForTab('tab-1', true)
    preferClaudeWebForTab('tab-2', false)

    expect(claudeWebPreferenceForTab('tab-1')).toBe(true)
    expect(claudeWebPreferenceForTab('tab-2')).toBe(false)
  })
})
