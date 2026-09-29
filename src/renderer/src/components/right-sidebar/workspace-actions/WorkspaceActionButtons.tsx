import React, { useState } from 'react'
import { CircleCheck, GitMerge, GitPullRequestArrow, ScanEye, Upload } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { WorkspaceActionKind } from '../../../../../shared/workspace-action'
import { selectWorkspaceActionContext } from './workspace-action-context'
import { launchWorkspaceAction, type WorkspaceActionLaunch } from './launch-workspace-action'

function primaryCopy(action: WorkspaceActionKind): { label: string; icon: React.JSX.Element } {
  switch (action) {
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

const BUTTON_CLASS =
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border/70 px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50'

export function WorkspaceActionButtons(): React.JSX.Element | null {
  const action = useAppStore((state) => selectWorkspaceActionContext(state)?.action ?? null)
  const canReview = useAppStore((state) => {
    const pr = selectWorkspaceActionContext(state)?.pr
    return pr?.state === 'open' || pr?.state === 'draft'
  })
  const [busy, setBusy] = useState<WorkspaceActionLaunch | null>(null)
  if (!action && !canReview) {
    return null
  }
  const run = (kind: WorkspaceActionLaunch): void => {
    setBusy(kind)
    void launchWorkspaceAction(kind).finally(() => setBusy(null))
  }
  const primary = action ? primaryCopy(action) : null
  return (
    <div className="flex shrink-0 items-center gap-1 pr-1" data-workspace-action-buttons="">
      {canReview ? (
        <button
          type="button"
          className={BUTTON_CLASS}
          disabled={busy !== null}
          onClick={() => run('review')}
        >
          <ScanEye className="size-3.5" />
          {translate('auto.components.workspaceActions.review', 'Review')}
        </button>
      ) : null}
      {primary ? (
        <button
          type="button"
          className={cn(BUTTON_CLASS, 'bg-accent/40')}
          disabled={busy !== null}
          onClick={() => run('primary')}
          data-workspace-action={action}
        >
          {primary.icon}
          {primary.label}
        </button>
      ) : null}
    </div>
  )
}
