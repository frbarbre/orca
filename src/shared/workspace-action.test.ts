import { describe, expect, it } from 'vitest'
import { resolveWorkspaceAction, type WorkspaceActionInput } from './workspace-action'

const clean: WorkspaceActionInput = {
  hasUncommittedChanges: false,
  hasUpstream: true,
  unpushedCommits: 0,
  hasLocalConflicts: false,
  isDefaultBranch: false,
  pullRequest: null,
  pullRequestKnown: true
}

describe('resolveWorkspaceAction', () => {
  it('offers create PR over commit & push when the branch has no pull request', () => {
    expect(resolveWorkspaceAction({ ...clean, hasUncommittedChanges: true })).toBe(
      'create-pull-request'
    )
    expect(resolveWorkspaceAction({ ...clean, unpushedCommits: 2 })).toBe('create-pull-request')
  })

  it('offers commit & push until the pull request lookup has answered', () => {
    const unknown = { ...clean, pullRequestKnown: false }
    expect(resolveWorkspaceAction({ ...unknown, hasUncommittedChanges: true })).toBe(
      'commit-and-push'
    )
    expect(resolveWorkspaceAction(unknown)).toBeNull()
  })

  it('offers commit & push over the pull request steps', () => {
    const pullRequest = { state: 'draft' as const, conflicting: true }
    expect(resolveWorkspaceAction({ ...clean, hasUncommittedChanges: true, pullRequest })).toBe(
      'commit-and-push'
    )
    expect(resolveWorkspaceAction({ ...clean, unpushedCommits: 2, pullRequest })).toBe(
      'commit-and-push'
    )
  })

  it('offers conflicts next, then ready for review, then create PR', () => {
    expect(
      resolveWorkspaceAction({ ...clean, pullRequest: { state: 'draft', conflicting: true } })
    ).toBe('resolve-conflicts')
    expect(
      resolveWorkspaceAction({ ...clean, pullRequest: { state: 'draft', conflicting: false } })
    ).toBe('ready-for-review')
    expect(resolveWorkspaceAction(clean)).toBe('create-pull-request')
  })

  it('puts a merge stopped on conflicts first, since it cannot be committed', () => {
    expect(
      resolveWorkspaceAction({ ...clean, hasLocalConflicts: true, hasUncommittedChanges: true })
    ).toBe('resolve-conflicts')
  })

  it('offers nothing for an open, clean pull request, a merged one, or the default branch', () => {
    expect(
      resolveWorkspaceAction({ ...clean, pullRequest: { state: 'open', conflicting: false } })
    ).toBeNull()
    expect(
      resolveWorkspaceAction({ ...clean, pullRequest: { state: 'merged', conflicting: false } })
    ).toBeNull()
    expect(resolveWorkspaceAction({ ...clean, isDefaultBranch: true })).toBeNull()
  })

  it('does not count commits as unpushed when the branch has no upstream yet', () => {
    expect(resolveWorkspaceAction({ ...clean, hasUpstream: false, unpushedCommits: 3 })).toBe(
      'create-pull-request'
    )
  })
})
