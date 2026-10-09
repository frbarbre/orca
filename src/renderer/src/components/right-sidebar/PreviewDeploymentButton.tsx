import React, { useEffect, useMemo, useState } from 'react'
import { Telescope } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { prCommentsCacheSuffix } from '@/store/github/cache-identity'
import { getGitHubRepoCacheKey } from '@/store/slices/github-cache-key'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { findLatestPreviewDeployment, previewDeploymentTooltip } from '@/lib/preview-deployment'
import { selectWorkspaceActionContext } from './workspace-actions/workspace-action-context'

function selectPreviewTarget(state: AppState) {
  const context = selectWorkspaceActionContext(state)
  const pr = context?.pr
  if (!context || !pr) {
    return null
  }
  const { repo } = context
  return {
    repoPath: repo.path,
    repoId: repo.id,
    prNumber: pr.number,
    prRepo: pr.prRepo,
    headSha: pr.headSha,
    commentsCacheKey: getGitHubRepoCacheKey(
      repo.path,
      repo.id,
      prCommentsCacheSuffix(pr.number, pr.prRepo),
      state.settings,
      repo.connectionId,
      repo.executionHostId,
      true
    )
  }
}

// Fork: our PRs get a bot comment per push with a preview URL; keep the newest one a click away.
export function PreviewDeploymentButton(): React.JSX.Element | null {
  const target = useAppStore(useShallow(selectPreviewTarget))
  const comments = useAppStore((s) =>
    target ? s.commentsCache[target.commentsCacheKey]?.data : undefined
  )
  const fetchPRComments = useAppStore((s) => s.fetchPRComments)
  const deployment = useMemo(
    () => (comments ? findLatestPreviewDeployment(comments) : null),
    [comments]
  )
  const [now, setNow] = useState(() => Date.now())

  const repoPath = target?.repoPath
  const repoId = target?.repoId
  const prNumber = target?.prNumber
  const prRepo = target?.prRepo
  const headSha = target?.headSha
  useEffect(() => {
    if (repoPath && prNumber) {
      void fetchPRComments(repoPath, prNumber, { repoId, prRepo }).catch(() => {})
    }
    // Why headSha: a push brings a new preview comment, so look again once the PR head moves.
  }, [fetchPRComments, repoPath, repoId, prNumber, prRepo, headSha])

  if (!target || !deployment) {
    return null
  }

  const refresh = (): void => {
    setNow(Date.now())
    void fetchPRComments(target.repoPath, target.prNumber, {
      repoId: target.repoId,
      prRepo: target.prRepo
    }).catch(() => {})
  }
  const tooltip = previewDeploymentTooltip(deployment, target.headSha, now)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="sidebar-toggle mr-1"
          aria-label={tooltip}
          data-preview-deployment=""
          onPointerEnter={refresh}
          onClick={() => void window.api.shell.openUrl(deployment.url)}
        >
          <Telescope size={16} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
