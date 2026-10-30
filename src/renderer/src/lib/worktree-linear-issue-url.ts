import type { AppState } from '@/store/types'
import { getLinearReadScope, scopedLinearCacheKey } from '@/store/slices/linear/linear-slice-scope'
import { getWorkspaceAttachmentSourceContext } from '@/components/sidebar/workspace-attachment-source-result'
import { getWorkspaceReferenceLinearWorkspaceId } from '@/components/sidebar/workspace-reference-details'
import { getWorkspaceAttachments } from '../../../shared/workspace-attachments'
import type { Worktree } from '../../../shared/worktree/types'
import type { TaskSourceContext } from '../../../shared/task-source-context'

type LinearIssueUrlState = Pick<
  AppState,
  'activeWorktreeId' | 'repos' | 'settings' | 'getKnownWorktreeById' | 'linearIssueCache'
>

export function worktreeLinearIssueCacheKey(
  worktree: Worktree,
  sourceContext: TaskSourceContext | null,
  settings: AppState['settings']
): string {
  if (!worktree.linkedLinearIssue) {
    return ''
  }
  const workspaceId = getWorkspaceReferenceLinearWorkspaceId(
    worktree.linkedLinearIssueWorkspaceId,
    sourceContext
  )
  return scopedLinearCacheKey(
    getLinearReadScope(settings, sourceContext),
    `${workspaceId}::${worktree.linkedLinearIssue}`
  )
}

/** The URL of the Linear issue the active workspace's card shows, when it has one. */
export function activeWorktreeLinearIssueUrl(state: LinearIssueUrlState): string | null {
  const worktree = state.activeWorktreeId
    ? state.getKnownWorktreeById(state.activeWorktreeId)
    : undefined
  if (!worktree?.linkedLinearIssue) {
    return null
  }
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  const sourceContext = getWorkspaceAttachmentSourceContext('linear', repo, worktree)
  const entry =
    state.linearIssueCache[worktreeLinearIssueCacheKey(worktree, sourceContext, state.settings)] ??
    (sourceContext ? undefined : state.linearIssueCache[worktree.linkedLinearIssue])
  if (entry?.data?.url) {
    return entry.data.url
  }
  const references = getWorkspaceAttachments(worktree).filter(
    (item) =>
      item.provider === 'linear' &&
      (item.identifier ?? item.linearIdentifier) === worktree.linkedLinearIssue
  )
  return references.length === 1 ? (references[0].url ?? null) : null
}
