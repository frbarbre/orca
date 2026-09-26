import React, { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { PRCommentPresentationClasses } from '../pr-comment-presentation'

const MIN_HEIGHT_PX = 60
const MAX_HEIGHT_PX = 240

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
  // Why measured rather than counted from the text: a wrapped line is as tall as two, and
  // the card in a diff view zone is resized from its rendered height.
  const grow = useCallback((element: HTMLTextAreaElement | null): void => {
    if (!element) {
      return
    }
    element.style.height = 'auto'
    element.style.height = `${Math.max(MIN_HEIGHT_PX, Math.min(element.scrollHeight, MAX_HEIGHT_PX))}px`
  }, [])

  return (
    <>
      <textarea
        autoFocus
        ref={grow}
        value={draft}
        onChange={(event) => {
          onDraftChange(event.target.value)
          grow(event.currentTarget)
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          // Why a modifier: Enter on its own belongs to the comment, which is prose.
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            if (canSave) {
              onSubmit()
            }
          }
        }}
        className={cn(
          'scrollbar-sleek w-full resize-none overflow-y-auto rounded-md border border-border bg-background px-2 py-1.5 text-foreground',
          presentation.commentEditorText
        )}
      />
      <div className="flex justify-end gap-1">
        <Button type="button" variant="ghost" size="xs" disabled={submitting} onClick={onCancel}>
          {translate('auto.components.right.sidebar.checks.panel.content.b062f55f29', 'Cancel')}
        </Button>
        <Button type="button" size="xs" disabled={!canSave} onClick={() => onSubmit()}>
          {translate('auto.components.right.sidebar.checks.panel.content.f6a40263ff', 'Save')}
        </Button>
      </div>
    </>
  )
}
