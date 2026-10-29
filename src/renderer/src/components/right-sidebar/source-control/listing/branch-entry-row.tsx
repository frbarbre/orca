import { cn } from '@/lib/utils'
import React from 'react'
import { MessageSquare, MessagesSquare, PencilLine } from 'lucide-react'
import { FileTypeIcon } from '@/components/FileTypeIcon'
import { basename, dirname, joinPath } from '@/lib/path'
import { WORKSPACE_FILE_PATH_MIME } from '@/lib/workspace-file-drag'
import { writeWorkspaceFileDragSourceForWorkspace } from '@/lib/workspace-file-drag-source'
import { translate } from '@/i18n/i18n'
import { AgentNoteFileBadge } from './agent-note-file-badge'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import { ChangeEntryStat } from './change-entry-stat'
import { reviewNoteCountTitle } from './review-note-count-title'
import { SourceControlEntryContextMenu } from './entry-context-menu'
import { toPermanentSourceControlRowOpenEvent, type SourceControlRowOpenEvent } from './split-open'
import {
  SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS,
  SOURCE_CONTROL_TREE_FILE_PADDING_PX,
  SOURCE_CONTROL_TREE_INDENT_PX
} from './row-layout'
import { ActionButton } from './action-button'
import { discardAction } from './discard-action'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { STATUS_COLORS } from '../../status-display'

export function BranchEntryRow({
  entry,
  currentWorktreeId,
  worktreePath,
  depth = 0,
  onRevealInExplorer,
  connectionId,
  onOpen,
  commentCount,
  reviewThreadCount,
  pendingReviewCount,
  isOpenFile = false,
  showPathHint = true,
  discardEntry,
  onDiscard
}: {
  entry: GitBranchChangeEntry
  currentWorktreeId: string
  worktreePath: string
  depth?: number
  onRevealInExplorer: (worktreeId: string, absolutePath: string) => void
  connectionId?: string | null
  onOpen: (event?: SourceControlRowOpenEvent) => void
  commentCount: number
  reviewThreadCount: number
  pendingReviewCount: number
  isOpenFile?: boolean
  showPathHint?: boolean
  /** Fork: the file's uncommitted change, when the all-changes list may discard it. */
  discardEntry?: GitStatusEntry
  onDiscard?: (entry: GitStatusEntry) => void
}): React.JSX.Element {
  const fileName = basename(entry.path)
  const parentDir = dirname(entry.path)
  const dirPath = parentDir === '.' ? '' : parentDir
  const discard = discardEntry && onDiscard ? discardAction(discardEntry) : null

  return (
    <SourceControlEntryContextMenu
      currentWorktreeId={currentWorktreeId}
      absolutePath={joinPath(worktreePath, entry.path)}
      relativePath={entry.path}
      hasWorkingTreeFile={entry.status !== 'deleted'}
      connectionId={connectionId}
      onView={() => onOpen()}
      onRevealInExplorer={onRevealInExplorer}
      discard={
        discard && discardEntry && onDiscard
          ? { label: discard.label, onDiscard: () => onDiscard(discardEntry) }
          : undefined
      }
    >
      <div
        // Why: mirrors the uncommitted row so the open file reads the same whether it came from the
        // working tree or the branch comparison.
        data-current={isOpenFile ? 'true' : undefined}
        data-source-control-path={entry.path}
        data-source-control-area="branch"
        className={cn(
          'group relative flex cursor-pointer items-center gap-1 pr-3 py-1 transition-colors',
          isOpenFile ? 'bg-accent hover:bg-accent' : 'hover:bg-accent/40'
        )}
        style={{
          paddingLeft: `${depth * SOURCE_CONTROL_TREE_INDENT_PX + SOURCE_CONTROL_TREE_FILE_PADDING_PX}px`
        }}
        draggable
        onDragStart={(e) => {
          const absolutePath = joinPath(worktreePath, entry.path)
          e.dataTransfer.setData(WORKSPACE_FILE_PATH_MIME, absolutePath)
          writeWorkspaceFileDragSourceForWorkspace(e.dataTransfer, currentWorktreeId)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={(e) => onOpen(e)}
        onDoubleClick={(e) => onOpen(toPermanentSourceControlRowOpenEvent(e))}
      >
        {React.createElement(FileTypeIcon, {
          filePath: entry.path,
          className: 'size-3.5 shrink-0',
          style: { color: STATUS_COLORS[entry.status] }
        })}
        <span className="min-w-0 flex-1 truncate text-xs">
          <span className="text-foreground">{fileName}</span>
          {showPathHint && dirPath && (
            <span className="ml-1.5 text-[11px] text-muted-foreground">{dirPath}</span>
          )}
        </span>
        {commentCount > 0 && (
          <span
            className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"
            title={reviewNoteCountTitle(commentCount)}
          >
            <MessageSquare className="size-3" />
            <span className="tabular-nums">{commentCount}</span>
          </span>
        )}
        <AgentNoteFileBadge filePath={entry.path} />
        {reviewThreadCount > 0 && (
          <span
            className="flex shrink-0 items-center gap-0.5 text-[10px] text-status-warning"
            title={translate(
              'auto.components.right.sidebar.SourceControl.unresolvedThreads',
              '{{value0}} unresolved review thread{{value1}}',
              { value0: reviewThreadCount, value1: reviewThreadCount === 1 ? '' : 's' }
            )}
          >
            <MessagesSquare className="size-3" />
            <span className="tabular-nums">{reviewThreadCount}</span>
          </span>
        )}
        {pendingReviewCount > 0 && (
          <span
            className="flex shrink-0 items-center gap-0.5 text-[10px] text-status-warning"
            title={translate(
              'auto.components.pendingReview.rowBadge',
              '{{value0}} review comment{{value1}} waiting to be submitted',
              { value0: pendingReviewCount, value1: pendingReviewCount === 1 ? '' : 's' }
            )}
          >
            <PencilLine className="size-3" />
            <span className="tabular-nums">{pendingReviewCount}</span>
          </span>
        )}
        <ChangeEntryStat entry={entry} />
        {discard && discardEntry && onDiscard ? (
          <div className={SOURCE_CONTROL_ROW_ACTION_OVERLAY_CLASS}>
            <ActionButton
              icon={discard.icon}
              title={discard.label}
              onClick={(event) => {
                event.stopPropagation()
                onDiscard(discardEntry)
              }}
            />
          </div>
        ) : null}
      </div>
    </SourceControlEntryContextMenu>
  )
}
