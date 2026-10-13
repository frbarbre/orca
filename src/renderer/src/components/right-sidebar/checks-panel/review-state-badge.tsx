import { Check, MessageSquare, Undo2, X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PRReviewSummaryState } from '../../../../../shared/github/comment-types'

const BADGE =
  'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium'

// Fork: a review summary says which verdict it came with, so it reads apart from plain comments.
export function ReviewStateBadge({
  state
}: {
  state: PRReviewSummaryState | undefined
}): React.JSX.Element | null {
  switch (state) {
    case 'approved':
      return (
        <span
          className={cn(
            BADGE,
            'bg-[color:var(--git-decoration-added)]/15 text-[color:var(--git-decoration-added)]'
          )}
        >
          <Check className="size-3" aria-hidden />
          {translate('prComments.reviewState.approved', 'Approved')}
        </span>
      )
    case 'changes-requested':
      return (
        <span
          className={cn(
            BADGE,
            'bg-[color:var(--git-decoration-deleted)]/15 text-[color:var(--git-decoration-deleted)]'
          )}
        >
          <X className="size-3" aria-hidden />
          {translate('prComments.reviewState.changesRequested', 'Changes requested')}
        </span>
      )
    case 'commented':
      return (
        <span className={cn(BADGE, 'bg-muted text-muted-foreground')}>
          <MessageSquare className="size-3" aria-hidden />
          {translate('prComments.reviewState.commented', 'Commented')}
        </span>
      )
    case 'dismissed':
      return (
        <span className={cn(BADGE, 'bg-muted text-muted-foreground')}>
          <Undo2 className="size-3" aria-hidden />
          {translate('prComments.reviewState.dismissed', 'Dismissed')}
        </span>
      )
    default:
      return null
  }
}
