import { useRef, useState } from 'react'
import { useRepoAssignees } from '@/hooks/useIssueMetadata'
import { ReviewerPicker } from '@/components/pull-request-page/reviewers/picker'
import {
  filterGitHubPRReviewerCandidates,
  getGitHubPRReviewerQueryState
} from '@/components/github/github-pr-reviewer-candidate-filter'
import { parseGitHubReviewerInputLogins } from '../../../../../../shared/github/pr-reviewer-display'
import type { PullRequestReviewer } from '../../../../../../shared/github/pull-request-reviewers'

export function PendingReviewReviewerPicker({
  repo,
  authorLogin,
  reviewers,
  onRequest,
  onRemove
}: {
  repo: { path: string; id: string } | null
  authorLogin: string | null
  reviewers: readonly PullRequestReviewer[]
  onRequest: (logins: string[]) => Promise<boolean>
  onRemove: (login: string) => Promise<boolean>
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const assignees = useRepoAssignees(open && repo ? repo.path : null, open && repo ? repo.id : null)

  const lower = (login: string): string => login.toLowerCase()
  const removable = new Set(reviewers.filter((r) => r.canRemove).map((r) => lower(r.login)))
  // Why left out: GitHub refuses a request to the author, and anyone who already reviewed is
  // asked again with the re-request button instead.
  const excluded = new Set(reviewers.filter((r) => !r.canRemove).map((r) => lower(r.login)))
  if (authorLogin) {
    excluded.add(lower(authorLogin))
  }
  const candidates = assignees.data.filter((user) => !excluded.has(lower(user.login)))
  const rows = filterGitHubPRReviewerCandidates({
    candidates,
    queryState: getGitHubPRReviewerQueryState(input)
  })

  const run = async (action: () => Promise<boolean>): Promise<void> => {
    if (submitting) {
      return
    }
    setSubmitting(true)
    try {
      if (await action()) {
        setInput('')
      }
    } finally {
      setSubmitting(false)
      inputRef.current?.focus()
    }
  }
  const toggle = (login: string): Promise<void> =>
    run(() => (removable.has(lower(login)) ? onRemove(login) : onRequest([login])))

  return (
    <ReviewerPicker
      open={open}
      submitting={submitting}
      canRequestReview={repo !== null}
      reviewerInput={input}
      reviewerInputRef={inputRef}
      reviewerMetadataLoading={assignees.loading}
      reviewerMetadataError={assignees.error}
      hasReviewerMetadata
      filteredReviewerCandidates={rows}
      suggestedReviewerRows={[]}
      everyoneElseReviewerRows={rows}
      actionableReviewerRows={rows}
      activeReviewerIndex={Math.min(activeIndex, Math.max(rows.length - 1, 0))}
      selectedReviewerLogins={removable}
      onOpenChange={(next) => {
        setOpen(next)
        setInput('')
        setActiveIndex(0)
        if (next) {
          requestAnimationFrame(() => inputRef.current?.focus())
        }
      }}
      onInputChange={(value) => {
        setInput(value)
        setActiveIndex(0)
      }}
      onActiveIndexChange={setActiveIndex}
      onEnter={() => {
        const active = rows[activeIndex]
        if (active) {
          void toggle(active.login)
          return
        }
        const typed = parseGitHubReviewerInputLogins(input)
        if (typed.length > 0) {
          void run(() => onRequest(typed))
        }
      }}
      onRequestReviewer={(reviewer) => void toggle(reviewer.login)}
    />
  )
}
