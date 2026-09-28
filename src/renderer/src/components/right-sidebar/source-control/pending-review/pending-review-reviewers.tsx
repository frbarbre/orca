import { useState } from 'react'
import { Check, FileDiff, LoaderCircle, MessageSquare, RefreshCw, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GitHubUserAvatar } from '@/components/github/github-user-avatar'
import { translate } from '@/i18n/i18n'
import type {
  PullRequestReviewer,
  PullRequestReviewerState
} from '../../../../../../shared/github/pull-request-reviewers'

function stateLabel(state: PullRequestReviewerState): string {
  switch (state) {
    case 'pending':
      return translate('auto.components.sourceControl.reviewers.pending', 'Awaiting review')
    case 're-requested':
      return translate(
        'auto.components.sourceControl.reviewers.reRequested',
        'Asked to review again'
      )
    case 'approved':
      return translate('auto.components.sourceControl.reviewers.approved', 'Approved')
    case 'changes-requested':
      return translate(
        'auto.components.sourceControl.reviewers.changesRequested',
        'Requested changes'
      )
    case 'commented':
      return translate('auto.components.sourceControl.reviewers.commented', 'Left comments')
    case 'dismissed':
      return translate('auto.components.sourceControl.reviewers.dismissed', 'Review dismissed')
  }
}

function StateIcon({ state }: { state: PullRequestReviewerState }): React.JSX.Element {
  switch (state) {
    case 'pending':
    case 're-requested':
      return <span className="size-2 rounded-full bg-status-warning" />
    case 'approved':
      return <Check className="size-3.5 text-status-success" />
    case 'changes-requested':
      return <FileDiff className="size-3.5 text-destructive" />
    case 'commented':
      return <MessageSquare className="size-3.5 text-muted-foreground" />
    case 'dismissed':
      return <X className="size-3.5 text-muted-foreground" />
  }
}

/**
 * Who is asked to review the pull request and where each of them stands, laid out like GitHub's
 * reviewer list, with GitHub's re-request button beside anyone who has already reviewed.
 */
export function PendingReviewReviewers({
  reviewers,
  onRerequest
}: {
  reviewers: readonly PullRequestReviewer[]
  onRerequest: (login: string) => Promise<boolean>
}): React.JSX.Element | null {
  const [requesting, setRequesting] = useState<string | null>(null)
  if (reviewers.length === 0) {
    return null
  }

  const rerequest = async (login: string): Promise<void> => {
    setRequesting(login)
    try {
      await onRerequest(login)
    } finally {
      setRequesting(null)
    }
  }

  return (
    <div className="px-3 pt-3">
      <div className="pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {translate('auto.components.sourceControl.reviewers.title', 'Reviewers')}
      </div>
      <ul className="space-y-0.5">
        {reviewers.map((reviewer) => (
          <li
            key={`${reviewer.kind}:${reviewer.login}`}
            className="flex h-7 items-center gap-2 text-xs"
          >
            {reviewer.kind === 'team' ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-muted">
                <Users className="size-3 text-muted-foreground" />
              </span>
            ) : (
              <GitHubUserAvatar
                login={reviewer.login}
                name={reviewer.name ?? undefined}
                avatarUrl={reviewer.avatarUrl ?? undefined}
                className="size-5"
              />
            )}
            <span className="min-w-0 flex-1 truncate">{reviewer.name ?? reviewer.login}</span>
            {reviewer.canRerequest ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={translate(
                      'auto.components.sourceControl.reviewers.rerequest',
                      'Re-request review from {{login}}',
                      { login: reviewer.login }
                    )}
                    disabled={requesting !== null}
                    onClick={() => void rerequest(reviewer.login)}
                  >
                    {requesting === reviewer.login ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {translate(
                    'auto.components.sourceControl.reviewers.rerequestTip',
                    'Re-request review'
                  )}
                </TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex size-5 items-center justify-center">
                  <StateIcon state={reviewer.state} />
                </span>
              </TooltipTrigger>
              <TooltipContent>{stateLabel(reviewer.state)}</TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </div>
  )
}
