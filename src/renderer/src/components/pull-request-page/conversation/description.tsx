import React, { useState } from 'react'
import { Check, LoaderCircle, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { githubMentionMarkdownExtension } from '@/components/github/github-mention-hover-card'
import { formatRelativeTime } from '@/components/github/work-item-state-presentation'
import { translate } from '@/i18n/i18n'
import type { MentionOption } from '../page-types'
import { Composer } from '@/components/composer/Composer'

export function ConversationDescription({
  authorLabel,
  updatedAt,
  canEditBody,
  loading,
  detailsLoaded,
  bodyEditing,
  bodySaving,
  bodyChanged,
  body,
  resolvedBodyDraft,
  mentionOptions,
  markdownGitHubRepo,
  onCancelEdit,
  onStartEdit,
  onSave,
  onDraftChange
}: {
  authorLabel: string
  updatedAt: string
  canEditBody: boolean
  loading: boolean
  detailsLoaded: boolean
  bodyEditing: boolean
  bodySaving: boolean
  bodyChanged: boolean
  body: string
  resolvedBodyDraft: string
  mentionOptions: MentionOption[]
  markdownGitHubRepo: { owner: string; repo: string; host?: string } | null
  onCancelEdit: () => void
  onStartEdit: () => void
  onSave: () => void
  onDraftChange: (value: string) => void
}): React.JSX.Element {
  const [uploading, setUploading] = useState(false)
  return (
    <div className="rounded-lg border border-border/50 bg-card shadow-xs">
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2 text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">{authorLabel}</span>
        <span>
          {translate('auto.components.PullRequestPage.169a93b29a', 'updated')}{' '}
          {formatRelativeTime(updatedAt)}
        </span>
        {canEditBody && !loading && detailsLoaded ? (
          bodyEditing ? (
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="gap-1.5"
                disabled={bodySaving}
                onClick={onCancelEdit}
              >
                <X className="size-3.5" />
                {translate('auto.components.PullRequestPage.6591b1fa82', 'Cancel')}
              </Button>
              <Button
                type="button"
                size="xs"
                className="gap-1.5"
                disabled={bodySaving || !bodyChanged || uploading}
                onClick={onSave}
              >
                {bodySaving ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                {translate('auto.components.PullRequestPage.4a337ac05f', 'Save')}
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto size-7"
                  onClick={onStartEdit}
                  aria-label={translate(
                    'auto.components.PullRequestPage.da9aaa8bcf',
                    'Edit description'
                  )}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {translate('auto.components.PullRequestPage.da9aaa8bcf', 'Edit description')}
              </TooltipContent>
            </Tooltip>
          )
        ) : null}
      </div>
      <div className="px-4 py-4 text-[14px] leading-relaxed text-foreground">
        {loading && !detailsLoaded ? (
          <div className="flex items-center justify-center py-5">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : bodyEditing ? (
          <Composer
            context="github"
            value={resolvedBodyDraft}
            onChange={onDraftChange}
            onCancel={() => {
              if (!bodySaving) {
                onCancelEdit()
              }
            }}
            onSubmit={() => {
              if (!bodySaving && bodyChanged && !uploading) {
                onSave()
              }
            }}
            onUploadingChange={setUploading}
            placeholder={translate('auto.components.PullRequestPage.778683ec84', 'Description')}
            people={mentionOptions}
            toolbar
            minHeightClassName="min-h-64"
            autoFocus
          />
        ) : body.trim() ? (
          <CommentMarkdown
            content={body}
            variant="document"
            githubRepo={markdownGitHubRepo}
            extension={githubMentionMarkdownExtension}
            className="min-w-0 max-w-full overflow-hidden break-words text-[14px] leading-relaxed [&_a]:break-all [&_code]:break-words [&_pre]:max-w-full"
          />
        ) : (
          <span className="italic text-muted-foreground">
            {translate('auto.components.PullRequestPage.c8ea6c7c4c', 'No description provided.')}
          </span>
        )}
      </div>
    </div>
  )
}
