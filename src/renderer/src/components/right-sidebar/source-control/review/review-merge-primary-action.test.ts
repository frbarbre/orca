import { describe, expect, it, vi } from 'vitest'
import { resolveReviewMergePrimaryAction } from './review-merge-primary-action'

const nothingToCommit = {
  kind: 'commit' as const,
  label: 'Commit',
  title: 'Linked review branch target is unavailable.',
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
    stagedCount: 0,
    hasUnstagedChanges: false,
    hasUnresolvedConflicts: false,
    isCommitting: false,
    isRemoteOperationActive: false,
    localHeadSha: 'abc123',
    reviewHeadSha: 'abc123',
    prState: 'open',
    reviewMerge: merge(),
    ...overrides
  } as never)

describe('resolveReviewMergePrimaryAction', () => {
  it('merges an open PR once its head is the commit checked out here, with its merge method', () => {
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

  it('keeps its own action while anything is uncommitted or the PR lacks the local head', () => {
    expect(resolve({ stagedCount: 1 })).toBe(nothingToCommit)
    expect(resolve({ hasUnstagedChanges: true })).toBe(nothingToCommit)
    expect(resolve({ reviewHeadSha: 'older' })).toBe(nothingToCommit)
    expect(resolve({ localHeadSha: null })).toBe(nothingToCommit)
    expect(resolve({ reviewHeadSha: undefined })).toBe(nothingToCommit)
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
