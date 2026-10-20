import React, { useCallback, useState } from 'react'
import { LoaderCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMountedRef } from '@/hooks/useMountedRef'
import { cn } from '@/lib/utils'
import {
  getCommentBodySubmitState,
  hasBoundedCommentBodyText
} from '@/lib/comment-body-submit-state'
import { addIssueCommentForRepo } from '@/components/github/github-work-item-comment-mutations'
import { translate } from '@/i18n/i18n'
import type { GitHubOwnerRepo } from '../../../../../shared/github/pull-request-types'
import type { PRComment } from '../../../../../shared/github/comment-types'
import type { TaskSourceContext } from '../../../../../shared/task-source-context'
import type { MentionOption } from '../page-types'
import { Composer } from '@/components/composer/Composer'
import { issueCommentDraftKey, useSavedDraft } from '@/lib/saved-drafts'

export function GHCommentComposer({
  className,
  repoPath,
  repoId,
  sourceContext,
  issueNumber,
  itemType,
  prRepo,
  mentionOptions,
  onCommentAdded
}: {
  className?: string
  repoPath: string
  repoId?: string | null
  sourceContext?: TaskSourceContext | null
  issueNumber: number
  itemType: 'issue' | 'pr'
  prRepo?: GitHubOwnerRepo | null
  mentionOptions: MentionOption[]
  onCommentAdded: (comment: PRComment) => void
}): React.JSX.Element {
  const [body, setBody] = useSavedDraft(issueCommentDraftKey(repoPath, prRepo, issueNumber))
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const mountedRef = useMountedRef()

  const handleSubmit = useCallback(async () => {
    const bodyState = getCommentBodySubmitState(body)
    if (bodyState.status === 'empty' || uploading) {
      return
    }
    if (bodyState.status === 'too-large-leading-whitespace') {
      toast.error(
        translate(
          'auto.components.PullRequestPage.commentTooLarge',
          'Comment is too large to submit safely.'
        )
      )
      return
    }
    setSubmitting(true)
    try {
      const result = await addIssueCommentForRepo({
        repoPath,
        repoId: repoId ?? undefined,
        sourceContext,
        number: issueNumber,
        body: bodyState.body,
        type: itemType,
        prRepo
      })
      if (result.ok) {
        setBody('')
      }
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        // Why: use GitHub's returned comment so the optimistic row shows the real login/avatar without a reopen.
        onCommentAdded(result.comment)
      } else {
        toast.error(
          result.error ??
            translate('auto.components.PullRequestPage.1208347ac0', 'Failed to add comment')
        )
      }
    } catch (err) {
      if (mountedRef.current) {
        toast.error(
          err instanceof Error
            ? err.message
            : translate('auto.components.PullRequestPage.1208347ac0', 'Failed to add comment')
        )
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }, [
    body,
    uploading,
    mountedRef,
    repoPath,
    repoId,
    sourceContext,
    issueNumber,
    itemType,
    prRepo,
    onCommentAdded,
    setBody
  ])
  const canSubmitComment = hasBoundedCommentBodyText(body)

  return (
    <div className={cn('relative', className)}>
      <Composer
        context="github"
        value={body}
        onChange={setBody}
        onSubmit={() => void handleSubmit()}
        onUploadingChange={setUploading}
        placeholder={translate('auto.components.PullRequestPage.d2030fc8cd', 'Add a comment…')}
        people={mentionOptions}
        minHeightClassName="min-h-20 pb-12 pr-12"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            onClick={() => void handleSubmit()}
            disabled={!canSubmitComment || submitting || uploading}
            className="absolute bottom-3 right-3 shadow-sm"
            aria-label={translate('auto.components.PullRequestPage.161d91ef02', 'Send comment')}
          >
            {submitting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {translate('auto.components.PullRequestPage.161d91ef02', 'Send comment')}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
