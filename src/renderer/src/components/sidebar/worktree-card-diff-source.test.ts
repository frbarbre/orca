import { describe, expect, it } from 'vitest'
import { resolveWorktreeCardDiff } from './worktree-card-diff-source'

const local = { added: 12, removed: 3, mergeBase: 'abc' }
const pr = { provider: 'github' as const, number: 7, title: 't', additions: 2087, deletions: 204 }

describe('resolveWorktreeCardDiff', () => {
  it("prefers the worktree's local diff over the PR's", () => {
    expect(resolveWorktreeCardDiff(local, pr)).toEqual({
      additions: 12,
      deletions: 3,
      source: 'local'
    })
  })

  it("falls back to the PR's GitHub totals before the local diff is known", () => {
    expect(resolveWorktreeCardDiff(undefined, pr)).toEqual({
      additions: 2087,
      deletions: 204,
      source: 'github'
    })
  })

  it('shows the local diff of a worktree without a PR', () => {
    expect(resolveWorktreeCardDiff(local, null)).toMatchObject({ source: 'local' })
  })

  it('has nothing to show without either', () => {
    expect(resolveWorktreeCardDiff(undefined, { provider: 'github', number: 7, title: 't' })).toBe(
      undefined
    )
  })
})
