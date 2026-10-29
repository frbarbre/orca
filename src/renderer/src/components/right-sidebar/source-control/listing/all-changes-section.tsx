import React, { useMemo } from 'react'
import { X } from 'lucide-react'
import { getIntlLocale, translate } from '@/i18n/i18n'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import type { SourceControlViewMode } from '../../../../../../shared/ui-chrome-types'
import type { SourceControlTreeNode } from '../../source-control-tree'
import type { SourceControlRowOpenEvent } from './split-open'
import { BranchEntryRow } from './branch-entry-row'
import { SectionHeader } from './section-header'
import { formatSourceControlRefLabel } from '../panel/branch-context-stats'
import { SourceControlBranchTreeDirectoryRow } from './tree-directory-rows'
import { VirtualizedList } from '../../../virtualized-list'
import { ALL_CHANGES_AREA } from './all-changes'

export type AllChangesTreeNode = SourceControlTreeNode<
  GitBranchChangeEntry,
  typeof ALL_CHANGES_AREA
>

function ListedLineTotal({
  entries
}: {
  entries: readonly GitBranchChangeEntry[]
}): React.JSX.Element | null {
  const { added, removed } = useMemo(
    () =>
      entries.reduce(
        (total, entry) => ({
          added: total.added + (entry.added ?? 0),
          removed: total.removed + (entry.removed ?? 0)
        }),
        { added: 0, removed: 0 }
      ),
    [entries]
  )
  if (added === 0 && removed === 0) {
    return null
  }
  const locale = getIntlLocale()
  return (
    <span
      data-testid="source-control-changes-line-total"
      title={translate(
        'allChanges.lineTotal',
        '{{added}} lines added, {{removed}} lines deleted in the listed files',
        { added, removed }
      )}
      className="mr-2 inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] font-medium tabular-nums"
    >
      <span className="text-[color:var(--git-decoration-added)]">
        +{added.toLocaleString(locale)}
      </span>
      <span className="text-[color:var(--git-decoration-deleted)]">
        -{removed.toLocaleString(locale)}
      </span>
    </span>
  )
}

// Fork: one section for every file changed against the base, committed or not, each row showing
// the file as it is on disk now.
export function SourceControlAllChangesSection({
  baseRef,
  entries,
  totalEntryCount,
  collapsed,
  onToggle,
  sourceControlViewMode,
  visibleTreeRows,
  fileListScrollElement,
  collapsedTreeDirs,
  toggleTreeDir,
  currentWorktreeId,
  worktreePath,
  revealInExplorer,
  activeConnectionId,
  onOpen,
  headerActions,
  filterBadge,
  onClearFilter,
  diffCommentCountByPath,
  reviewThreadCountByPath,
  pendingReviewCountByPath,
  activeOpenRowKeys,
  activeOpenRowKey,
  discardableByPath,
  onDiscard
}: {
  baseRef: string | null
  entries: GitBranchChangeEntry[]
  totalEntryCount: number
  collapsed: boolean
  onToggle: () => void
  sourceControlViewMode: SourceControlViewMode
  visibleTreeRows: readonly AllChangesTreeNode[]
  fileListScrollElement: HTMLDivElement | null
  collapsedTreeDirs: Set<string>
  toggleTreeDir: (key: string) => void
  currentWorktreeId: string
  worktreePath: string
  revealInExplorer: (worktreeId: string, absolutePath: string) => void
  activeConnectionId: string | null
  onOpen: (entry: GitBranchChangeEntry, event?: SourceControlRowOpenEvent) => void
  headerActions?: React.ReactNode
  /** Fork: the active Changes filter (Uncommitted, a turn, a commit), removable from the header. */
  filterBadge?: { label: string; title?: string } | null
  onClearFilter?: () => void
  diffCommentCountByPath: Map<string, number>
  reviewThreadCountByPath: Map<string, number>
  pendingReviewCountByPath: Map<string, number>
  activeOpenRowKeys: ReadonlySet<string>
  activeOpenRowKey: string | null
  /** Fork: each file's uncommitted change that its row may discard. */
  discardableByPath?: ReadonlyMap<string, GitStatusEntry>
  onDiscard?: (entry: GitStatusEntry) => void
}): React.JSX.Element {
  const fileCount = entries.length
  const ref = baseRef?.trim()
  // Why silent under a filter: a narrowed count is not the number of files changed vs the base.
  const countTitle =
    ref && fileCount === totalEntryCount
      ? fileCount === 1
        ? translate(
            'auto.components.right.sidebar.SourceControl.branchFilesChangedVsBaseOne',
            '1 file changed vs {{ref}}',
            { ref: formatSourceControlRefLabel(ref) }
          )
        : translate(
            'auto.components.right.sidebar.SourceControl.branchFilesChangedVsBaseOther',
            '{{count}} files changed vs {{ref}}',
            { count: fileCount, ref: formatSourceControlRefLabel(ref) }
          )
      : undefined

  const renderEntry = (
    entry: GitBranchChangeEntry,
    key: string,
    depth?: number
  ): React.JSX.Element => (
    <BranchEntryRow
      key={key}
      entry={entry}
      currentWorktreeId={currentWorktreeId}
      worktreePath={worktreePath}
      depth={depth}
      onRevealInExplorer={revealInExplorer}
      connectionId={activeConnectionId}
      onOpen={(event) => onOpen(entry, event)}
      commentCount={diffCommentCountByPath.get(entry.path) ?? 0}
      reviewThreadCount={reviewThreadCountByPath.get(entry.path) ?? 0}
      pendingReviewCount={pendingReviewCountByPath.get(entry.path) ?? 0}
      isOpenFile={activeOpenRowKeys.has(key)}
      showPathHint={depth === undefined}
      discardEntry={discardableByPath?.get(entry.path)}
      onDiscard={onDiscard}
    />
  )

  return (
    <div>
      <SectionHeader
        label={translate('allChanges.title', 'Changes')}
        count={fileCount}
        countTitle={countTitle}
        isCollapsed={collapsed}
        onToggle={onToggle}
        actions={
          <>
            <ListedLineTotal entries={entries} />
            {filterBadge && (
              <span
                title={filterBadge.title}
                className="flex h-5 min-w-0 items-center gap-0.5 rounded-full border border-border bg-muted pl-2 pr-0.5 text-[11px] text-foreground"
              >
                <span className="truncate">{filterBadge.label}</span>
                <button
                  type="button"
                  aria-label={translate('allChanges.showAllChanges', 'Show all changes')}
                  className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation()
                    onClearFilter?.()
                  }}
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            {headerActions}
          </>
        }
      />
      {!collapsed &&
        (sourceControlViewMode === 'tree' ? (
          <VirtualizedList
            rows={visibleTreeRows}
            scrollElement={fileListScrollElement}
            getRowKey={(node) => node.key}
            scrollToRowKey={activeOpenRowKey}
            renderRow={(node) =>
              node.type === 'directory' ? (
                <SourceControlBranchTreeDirectoryRow
                  key={node.key}
                  node={node}
                  isCollapsed={collapsedTreeDirs.has(node.key)}
                  onToggle={() => toggleTreeDir(node.key)}
                />
              ) : (
                renderEntry(node.entry, node.key, node.depth)
              )
            }
          />
        ) : (
          <VirtualizedList
            rows={entries}
            scrollElement={fileListScrollElement}
            getRowKey={(entry) => `${ALL_CHANGES_AREA}::${entry.path}`}
            scrollToRowKey={activeOpenRowKey}
            renderRow={(entry) => renderEntry(entry, `${ALL_CHANGES_AREA}::${entry.path}`)}
          />
        ))}
    </div>
  )
}
