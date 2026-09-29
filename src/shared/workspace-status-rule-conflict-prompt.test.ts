import { describe, expect, it } from 'vitest'
import { buildConflictAgentPrompt } from './workspace-status-rule-conflict-prompt'

describe('buildConflictAgentPrompt', () => {
  const prompt = buildConflictAgentPrompt({ baseRef: 'main', worktreePath: '/w/e-4861' })

  it('merges the pull request base into the workspace', () => {
    expect(prompt).toContain('git fetch origin main')
    expect(prompt).toContain('/w/e-4861')
  })

  it('tells the agent to push, and never to force-push', () => {
    expect(prompt).not.toContain('Do not push')
    expect(prompt).toContain('push the branch with a plain git push')
    expect(prompt).toContain('Never force-push')
  })
})
