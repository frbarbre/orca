import { describe, expect, it, vi } from 'vitest'
import { resolveReviewMergePrimaryAction } from './review-merge-primary-action'

const upToDate = { stagedCount: 0, hasUnstagedChanges: false, hasUnresolvedConflicts: false }
const nothingToCommit = {
  kind: 'commit' as const,
  label: 'Commit',
  title: 'Nothing to commit. Branch is up to date.',
  disabled: true
}
const merge = (overrides = {}) => ({
  kind: 'merge' as const,
  label: 'Squash and merge',
  tooltip: 'Ready to merge',
  disabled: false,
  run: vi.fn(),
  ...overrides
})
const resolve = (overrides: Record<string, unknown> = {}) =>
  resolveReviewMergePrimaryAction(nothingToCommit, {
    ...upToDate,
    isCommitting: false,
    isRemoteOperationActive: false,
    upstreamStatus: { hasUpstream: true, ahead: 0, behind: 0 },
    prState: 'open',
    reviewMerge: merge(),
    ...overrides
  } as never)

describe('resolveReviewMergePrimaryAction', () => {
  it('merges an open PR once everything is committed and pushed, with its merge method', () => {
    expect(resolve()).toEqual({
      kind: 'merge',
      label: 'Squash and merge',
      title: 'Ready to merge',
      disabled: false
    })
  })

  it('turns auto-merge on when the PR cannot merge yet', () => {
    expect(
      resolve({
        reviewMerge: merge({ kind: 'auto_merge', label: 'Enable auto-merge', tooltip: 'Waiting' })
      })
    ).toMatchObject({ kind: 'auto_merge', label: 'Enable auto-merge', disabled: false })
  })

  it('keeps its own action while anything is uncommitted, unpushed or behind', () => {
    expect(resolve({ stagedCount: 1 })).toBe(nothingToCommit)
    expect(resolve({ hasUnstagedChanges: true })).toBe(nothingToCommit)
    expect(resolve({ upstreamStatus: { hasUpstream: true, ahead: 1, behind: 0 } })).toBe(
      nothingToCommit
    )
    expect(resolve({ upstreamStatus: { hasUpstream: true, ahead: 0, behind: 2 } })).toBe(
      nothingToCommit
    )
    expect(resolve({ upstreamStatus: { hasUpstream: false, ahead: 0, behind: 0 } })).toBe(
      nothingToCommit
    )
  })

  it('leaves drafts, closed PRs and busy states alone', () => {
    expect(resolve({ prState: 'draft' })).toBe(nothingToCommit)
    expect(resolve({ prState: 'merged' })).toBe(nothingToCommit)
    expect(resolve({ reviewMerge: null })).toBe(nothingToCommit)
    expect(resolve({ isCommitting: true })).toBe(nothingToCommit)
    expect(resolve({ isRemoteOperationActive: true })).toBe(nothingToCommit)
    expect(resolve({ hasUnresolvedConflicts: true })).toBe(nothingToCommit)
  })

  it('shows why a merge is held back, such as GitHub still waiting on checks', () => {
    expect(resolve({ reviewMerge: merge({ disabled: true, tooltip: 'Checks pending' }) })).toEqual({
      kind: 'merge',
      label: 'Squash and merge',
      title: 'Checks pending',
      disabled: true
    })
  })
})
