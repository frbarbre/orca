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

  it('merges an open pull request, or toggles its auto-merge, once its head is the local commit', () => {
    const open = (mergeAction: 'merge' | 'enable-auto-merge' | 'disable-auto-merge' | null) => ({
      ...clean,
      pullRequest: { state: 'open' as const, conflicting: false, mergeAction, headIsLocal: true }
    })
    expect(resolveWorkspaceAction(open('merge'))).toBe('merge')
    expect(resolveWorkspaceAction(open('enable-auto-merge'))).toBe('enable-auto-merge')
    expect(resolveWorkspaceAction(open('disable-auto-merge'))).toBe('disable-auto-merge')
    expect(resolveWorkspaceAction(open(null))).toBeNull()
  })

  it('never offers a merge before local work is committed and on the pull request', () => {
    const pullRequest = {
      state: 'open' as const,
      conflicting: false,
      mergeAction: 'merge' as const,
      headIsLocal: true
    }
    expect(resolveWorkspaceAction({ ...clean, hasUncommittedChanges: true, pullRequest })).toBe(
      'commit-and-push'
    )
    expect(resolveWorkspaceAction({ ...clean, unpushedCommits: 1, pullRequest })).toBe(
      'commit-and-push'
    )
    expect(
      resolveWorkspaceAction({ ...clean, pullRequest: { ...pullRequest, headIsLocal: false } })
    ).toBeNull()
    expect(
      resolveWorkspaceAction({
        ...clean,
        pullRequest: { ...pullRequest, state: 'draft' as const }
      })
    ).toBe('ready-for-review')
  })

  it('does not count commits as unpushed when the branch has no upstream yet', () => {
    expect(resolveWorkspaceAction({ ...clean, hasUpstream: false, unpushedCommits: 3 })).toBe(
      'create-pull-request'
    )
  })
})
