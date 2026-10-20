import { useMemo } from 'react'
import { useAllWorktrees } from '@/store/selectors'
import type { GitHubWorkItem } from '../../../shared/github/work-item-types'
import { findGithubWorkItemWorkspaceAttachment } from './github-work-item-workspace-attachment'

export function useGitHubWorkItemWorkspaceId(
  item: Pick<GitHubWorkItem, 'type' | 'number' | 'url' | 'repoId'>,
  repoId: string | null | undefined
): string | null {
  const allWorktrees = useAllWorktrees()
  const effectiveRepoId = repoId ?? item.repoId ?? null
  return useMemo(
    () =>
      findGithubWorkItemWorkspaceAttachment(
        allWorktrees,
        effectiveRepoId,
        item.type,
        item.number,
        item.url
      )?.id ?? null,
    [allWorktrees, effectiveRepoId, item.number, item.type, item.url]
  )
}
