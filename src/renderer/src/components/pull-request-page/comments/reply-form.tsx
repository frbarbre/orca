import React, { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { cn } from '@/lib/utils'
import {
  getCommentBodySubmitState,
  hasBoundedCommentBodyText
} from '@/lib/comment-body-submit-state'
import { translate } from '@/i18n/i18n'
import type { MentionOption } from '../page-types'
import { Composer } from '@/components/composer/Composer'
import { useSavedDraft } from '@/lib/saved-drafts'

export function CommentReplyForm({
  className,
  placeholder,
  mentionOptions,
  draftKey,
  onCancel,
  onSubmit
}: {
  className?: string
  placeholder: string
  mentionOptions: MentionOption[]
  draftKey: string
  onCancel: () => void
  onSubmit: (body: string) => Promise<boolean>
}): React.JSX.Element {
  const [body, setBody] = useSavedDraft(draftKey)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const mountedRef = useMountedRef()

  const submit = useCallback(async () => {
    const bodyState = getCommentBodySubmitState(body)
    if (bodyState.status === 'empty' || submitting || uploading) {
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
      const ok = await onSubmit(bodyState.body)
      if (ok) {
        setBody('')
      }
    } catch (error) {
      if (mountedRef.current) {
        toast.error(
          error instanceof Error
            ? error.message
            : translate('auto.components.PullRequestPage.5821aab360', 'Failed to post reply.')
        )
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }, [body, mountedRef, onSubmit, setBody, submitting, uploading])
  const canSubmitReply = hasBoundedCommentBodyText(body)

  return (
    <div className={cn('rounded-md border border-border/50 bg-background/60 p-2', className)}>
      <Composer
        context="github"
        value={body}
        onChange={setBody}
        onSubmit={() => void submit()}
        onCancel={onCancel}
        onUploadingChange={setUploading}
        placeholder={placeholder}
        people={mentionOptions}
        minHeightClassName="min-h-20"
        autoFocus
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {translate('auto.components.PullRequestPage.6591b1fa82', 'Cancel')}
        </Button>
        <Button
          size="sm"
          disabled={!canSubmitReply || submitting || uploading}
          onClick={() => void submit()}
        >
          {submitting
            ? translate('auto.components.PullRequestPage.894cfd884b', 'Posting…')
            : translate('auto.components.PullRequestPage.f119e5f5ef', 'Reply')}
        </Button>
      </div>
    </div>
  )
}
