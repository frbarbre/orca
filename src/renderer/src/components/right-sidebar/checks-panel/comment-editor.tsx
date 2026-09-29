import React, { useState } from 'react'
import { ReviewMarkdownComposer } from '@/components/github/ReviewMarkdownComposer'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { PRCommentPresentationClasses } from '../pr-comment-presentation'

/** The in-place editor for a comment body, used for drafts and posted comments alike. */
export function CommentEditor({
  draft,
  onDraftChange,
  canSave,
  submitting,
  presentation,
  onSubmit,
  onCancel
}: {
  draft: string
  onDraftChange: (draft: string) => void
  canSave: boolean
  submitting: boolean
  presentation: PRCommentPresentationClasses
  onSubmit: () => void
  onCancel: (event: React.MouseEvent) => void
}): React.JSX.Element {
  const [uploading, setUploading] = useState(false)
  const canSaveNow = canSave && !uploading

  return (
    <>
      <div onClick={(event) => event.stopPropagation()}>
        <ReviewMarkdownComposer
          value={draft}
          onChange={onDraftChange}
          placeholder={translate(
            'auto.components.right.sidebar.checks.panel.commentEditor.placeholder',
            'Edit comment'
          )}
          autoFocus
          onUploadingChange={setUploading}
          onSubmitShortcut={() => {
            if (canSaveNow) {
              onSubmit()
            }
          }}
          minHeightClassName="min-h-28"
          className={cn('text-foreground', presentation.commentEditorText)}
        />
      </div>
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="xs" disabled={submitting} onClick={onCancel}>
          {translate('auto.components.right.sidebar.checks.panel.content.b062f55f29', 'Cancel')}
        </Button>
        <Button type="button" size="xs" disabled={!canSaveNow} onClick={() => onSubmit()}>
          {translate('auto.components.right.sidebar.checks.panel.content.f6a40263ff', 'Save')}
        </Button>
      </div>
    </>
  )
}
