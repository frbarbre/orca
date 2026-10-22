import React, { useState } from 'react'
import { CircleCheck, GitMerge, GitPullRequestArrow, ScanEye, Upload } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import type { WorkspaceActionKind } from '../../../../../shared/workspace-action'
import type { PRInfo } from '../../../../../shared/github/pull-request-types'
import { resolveGitHubPRMergeMethods } from '../../../../../shared/github/pull-request-merge-methods'
import { presentGitHubPRMergeState } from '@/components/github-pr-merge-state'
import { selectWorkspaceActionContext } from './workspace-action-context'
import { launchWorkspaceAction, type WorkspaceActionLaunch } from './launch-workspace-action'

function primaryCopy(
  action: WorkspaceActionKind,
  pr: PRInfo | null
): { label: string; icon: React.JSX.Element } {
  switch (action) {
    case 'merge':
      return {
        label: resolveGitHubPRMergeMethods(pr?.mergeMethodSettings ?? null).defaultLabel,
        icon: <GitMerge className="size-3.5" />
      }
    case 'enable-auto-merge':
    case 'disable-auto-merge':
      return {
        label:
          (pr ? presentGitHubPRMergeState(pr).autoMergeAction?.label : null) ??
          (action === 'enable-auto-merge'
            ? translate('auto.components.workspaceActions.enableAutoMerge', 'Enable auto-merge')
            : translate('auto.components.workspaceActions.disableAutoMerge', 'Disable auto-merge')),
        icon: <GitMerge className="size-3.5" />
      }
    case 'commit-and-push':
      return {
        label: translate('auto.components.workspaceActions.commitAndPush', 'Commit & push'),
        icon: <Upload className="size-3.5" />
      }
    case 'resolve-conflicts':
      return {
        label: translate('auto.components.workspaceActions.resolveConflicts', 'Resolve conflicts'),
        icon: <GitMerge className="size-3.5" />
      }
    case 'ready-for-review':
      return {
        label: translate('auto.components.workspaceActions.readyForReview', 'Ready for review'),
        icon: <CircleCheck className="size-3.5" />
      }
    case 'create-pull-request':
      return {
        label: translate('auto.components.workspaceActions.createPr', 'Create PR'),
        icon: <GitPullRequestArrow className="size-3.5" />
      }
  }
}

function useWorkspaceActionLauncher(): {
  busy: boolean
  run: (kind: WorkspaceActionLaunch) => void
} {
  const [busy, setBusy] = useState(false)
  return {
    busy,
    run: (kind) => {
      setBusy(true)
      void launchWorkspaceAction(kind).finally(() => setBusy(false))
    }
  }
}

/** The top bar's Review button: an icon, like the other header buttons beside it. */
export function WorkspaceReviewButton(): React.JSX.Element | null {
  const canReview = useAppStore((state) => {
    const pr = selectWorkspaceActionContext(state)?.pr
    return pr?.state === 'open' || pr?.state === 'draft'
  })
  const { busy, run } = useWorkspaceActionLauncher()
  if (!canReview) {
    return null
  }
  const label = translate('auto.components.workspaceActions.review', 'Review')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          disabled={busy}
          onClick={() => run('review')}
        >
          <ScanEye className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** Fork: the workspace's next step, written out so it can be read at a glance. */
export function WorkspaceNextActionButton(): React.JSX.Element | null {
  const action = useAppStore((state) => selectWorkspaceActionContext(state)?.action ?? null)
  const pr = useAppStore((state) => selectWorkspaceActionContext(state)?.pr ?? null)
  const { busy, run } = useWorkspaceActionLauncher()
  if (!action) {
    return null
  }
  const { label, icon } = primaryCopy(action, pr)
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      disabled={busy}
      onClick={() => run('primary')}
      data-workspace-action={action}
    >
      {icon}
      {label}
    </Button>
  )
}
