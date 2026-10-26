import React, { useEffect, useMemo, useState } from 'react'
import { Telescope } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { HeaderButtonTooltip } from './HeaderButtonTooltip'
import { Button } from '@/components/ui/button'
import { findLatestPreviewDeployment, previewDeploymentTooltip } from '@/lib/preview-deployment'
import { selectPreviewTarget } from './preview-deployment-target'

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
    <HeaderButtonTooltip label={tooltip} shortcut="sourceControl.openPullRequestPreview">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={tooltip}
        data-preview-deployment=""
        onPointerEnter={refresh}
        onClick={() => void window.api.shell.openUrl(deployment.url)}
      >
        <Telescope className="size-3.5" />
      </Button>
    </HeaderButtonTooltip>
  )
}
