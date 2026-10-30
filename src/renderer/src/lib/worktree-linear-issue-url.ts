import type { AppState } from '@/store/types'
import { getWorkspaceAttachmentSourceContext } from '@/components/sidebar/workspace-attachment-source-result'
import { getWorkspaceReferenceLinearWorkspaceId } from '@/components/sidebar/workspace-reference-details'
import { getWorkspaceAttachments } from '../../../shared/workspace-attachments'
import { getTaskSourceCacheScope } from '../../../shared/task-source-context'

type LinearIssueUrlState = Pick<
  AppState,
  'activeWorktreeId' | 'repos' | 'getKnownWorktreeById' | 'linearIssueCache'
>

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
  const issueKey = `${getWorkspaceReferenceLinearWorkspaceId(
    worktree.linkedLinearIssueWorkspaceId,
    sourceContext
  )}::${worktree.linkedLinearIssue}`
  const entry = sourceContext
    ? state.linearIssueCache[`${getTaskSourceCacheScope(sourceContext)}::${issueKey}`]
    : (state.linearIssueCache[issueKey] ?? state.linearIssueCache[worktree.linkedLinearIssue])
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
