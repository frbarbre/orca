import { describe, expect, it, vi } from 'vitest'
import type { Worktree } from '../../../../shared/worktree/types'
import { findStackEntryWorktree, openGitHubPRStackEntry } from './github-pr-stack-entry-worktree'

function worktree(id: string, branch: string, linkedPR: number | null = null): Worktree {
  return { id, repoId: 'repo', branch, linkedPR } as Worktree
}

describe('findStackEntryWorktree', () => {
  const entry = { number: 3714, headRefName: 'e-6155' }

  it("finds the worktree checked out on the entry's branch", () => {
    const worktrees = [worktree('a', 'refs/heads/e-6156'), worktree('b', 'refs/heads/e-6155')]
    expect(findStackEntryWorktree(worktrees, entry)?.id).toBe('b')
  })

  it('prefers a worktree linked to the PR over one that only shares its branch name', () => {
    const worktrees = [worktree('a', 'refs/heads/e-6155'), worktree('b', 'refs/heads/other', 3714)]
    expect(findStackEntryWorktree(worktrees, entry)?.id).toBe('b')
  })

  it('finds nothing when no worktree has the PR', () => {
    expect(findStackEntryWorktree([worktree('a', 'refs/heads/e-6156')], entry)).toBeUndefined()
    expect(
      findStackEntryWorktree([worktree('a', 'refs/heads/e-6156')], { number: 1 })
    ).toBeUndefined()
  })
})

describe('openGitHubPRStackEntry', () => {
  const entry = {
    number: 3714,
    headRefName: 'e-6155',
    url: 'https://github.com/acme/repo/pull/3714'
  }
  const noModifiers = { metaKey: false, ctrlKey: false, shiftKey: false }

  function open(worktrees: Worktree[], modifiers = noModifiers) {
    const activateWorktree = vi.fn()
    const openUrl = vi.fn()
    openGitHubPRStackEntry(entry, modifiers, { worktrees, activateWorktree, openUrl })
    return { activateWorktree, openUrl }
  }

  it("switches to the PR's worktree instead of opening GitHub", () => {
    const { activateWorktree, openUrl } = open([worktree('b', 'refs/heads/e-6155')])
    expect(activateWorktree).toHaveBeenCalledWith('b')
    expect(openUrl).not.toHaveBeenCalled()
  })

  it('opens the PR on GitHub when no worktree has it', () => {
    const { activateWorktree, openUrl } = open([worktree('a', 'refs/heads/e-6156')])
    expect(activateWorktree).not.toHaveBeenCalled()
    expect(openUrl).toHaveBeenCalledWith(entry.url, noModifiers)
  })

  it('opens GitHub on a modifier click even when a worktree has the PR', () => {
    const modifiers = { ...noModifiers, metaKey: true }
    const { activateWorktree, openUrl } = open([worktree('b', 'refs/heads/e-6155')], modifiers)
    expect(activateWorktree).not.toHaveBeenCalled()
    expect(openUrl).toHaveBeenCalledWith(entry.url, modifiers)
  })
})
