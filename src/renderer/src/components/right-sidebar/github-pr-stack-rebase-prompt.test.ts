import { describe, expect, it } from 'vitest'
import type { GitHubPRStack } from '../../../../shared/github/pull-request-types'
import { buildGitHubPRStackRebasePrompt } from './github-pr-stack-rebase-prompt'

const entry = (position: number, state: 'open' | 'merged', headRefName: string) => ({
  position,
  number: 100 + position,
  title: `PR ${position}`,
  url: `https://github.com/acme/repo/pull/${100 + position}`,
  state,
  checksStatus: 'success' as const,
  mergeable: 'MERGEABLE' as const,
  headRefName
})

const stack: GitHubPRStack = {
  number: 51,
  position: 3,
  size: 3,
  baseRefName: 'main',
  entries: [
    entry(3, 'open', 'stack/ui'),
    entry(1, 'merged', 'stack/models'),
    entry(2, 'open', 'stack/api')
  ]
}

describe('buildGitHubPRStackRebasePrompt', () => {
  it('points the agent at the stacking skill and lists the open PRs from the base up', () => {
    const prompt = buildGitHubPRStackRebasePrompt(stack)

    expect(prompt).toContain('/fba-stack-prs')
    expect(prompt).toContain('`main`')
    expect(prompt).not.toContain('stack/models')
    expect(prompt.indexOf('#102 `stack/api`')).toBeGreaterThan(-1)
    expect(prompt.indexOf('#102 `stack/api`')).toBeLessThan(prompt.indexOf('#103 `stack/ui`'))
    expect(prompt).toMatch(/force-push/i)
    expect(prompt).toMatch(/do not run (any )?validation/i)
  })
})
