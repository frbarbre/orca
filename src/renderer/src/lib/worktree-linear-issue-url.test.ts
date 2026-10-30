import { describe, expect, it } from 'vitest'
import { getWorkspaceAttachmentSourceContext } from '@/components/sidebar/workspace-attachment-source-result'
import { getTaskSourceCacheScope } from '../../../shared/task-source-context'
import { activeWorktreeLinearIssueUrl } from './worktree-linear-issue-url'

const repo = { id: 'repo-1', path: '/code/app', displayName: 'app', badgeColor: '', addedAt: 0 }
const worktree = {
  id: 'repo-1::/code/app-wt',
  repoId: 'repo-1',
  path: '/code/app-wt',
  branch: 'refs/heads/feature',
  head: 'abc',
  linkedLinearIssue: 'ENG-42'
}

function state(overrides: Record<string, unknown> = {}, wt: Record<string, unknown> = worktree) {
  return {
    activeWorktreeId: worktree.id,
    repos: [repo],
    getKnownWorktreeById: (id: string) => (id === worktree.id ? wt : undefined),
    linearIssueCache: {},
    ...overrides
  } as never
}

describe('activeWorktreeLinearIssueUrl', () => {
  it("gives the URL of the Linear issue the active workspace's card shows", () => {
    const source = getWorkspaceAttachmentSourceContext('linear', repo as never, worktree as never)
    const key = `${getTaskSourceCacheScope(source!)}::all::ENG-42`
    const linearIssueCache = {
      [key]: { data: { identifier: 'ENG-42', url: 'https://linear.app/acme/issue/ENG-42' } }
    }
    expect(activeWorktreeLinearIssueUrl(state({ linearIssueCache }))).toBe(
      'https://linear.app/acme/issue/ENG-42'
    )
  })

  it("falls back to the workspace's single Linear attachment before the issue loads", () => {
    const attached = {
      ...worktree,
      linkedItems: [
        {
          provider: 'linear',
          type: 'issue',
          number: 42,
          identifier: 'ENG-42',
          url: 'https://linear.app/acme/issue/ENG-42/title'
        }
      ]
    }
    expect(activeWorktreeLinearIssueUrl(state({}, attached))).toBe(
      'https://linear.app/acme/issue/ENG-42/title'
    )
  })

  it('gives nothing without a linked issue or an active workspace', () => {
    expect(
      activeWorktreeLinearIssueUrl(state({}, { ...worktree, linkedLinearIssue: null }))
    ).toBeNull()
    expect(activeWorktreeLinearIssueUrl(state({ activeWorktreeId: null }))).toBeNull()
  })
})
