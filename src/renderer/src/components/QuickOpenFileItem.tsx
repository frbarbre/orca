import React from 'react'
import { FileTypeIcon } from '@/components/FileTypeIcon'
import { CommandItem } from '@/components/ui/command'
import { FilePathCursorTooltip, splitTrailingSegment } from '@/components/file-path-cursor-tooltip'
import type { GitBranchChangeEntry } from '../../../shared/git-diff-compare-types'
import { ChangeEntryStat } from './right-sidebar/source-control/listing/change-entry-stat'

export function QuickOpenFileItem({
  path,
  change,
  disabled,
  onSelect
}: {
  path: string
  change: GitBranchChangeEntry | undefined
  disabled: boolean
  onSelect: (path: string) => void
}): React.JSX.Element {
  const { directory, filename } = splitTrailingSegment(path)
  return (
    <CommandItem
      value={path}
      onSelect={() => onSelect(path)}
      disabled={disabled}
      // Why: CommandDialog's descendant rule otherwise adds 24px of vertical padding.
      className="min-w-0 !p-0"
    >
      {/* Why: the trigger is this inner element, not the CommandItem.
          cmdk sets its own onPointerMove after spreading props, which
          drops the one Radix needs to open the tooltip. */}
      <FilePathCursorTooltip path={path}>
        <div className="flex w-full min-w-0 items-center gap-2 px-3 py-1">
          <FileTypeIcon filePath={path} className="size-3.5 shrink-0 text-muted-foreground" />
          {/* shrink-0 + max-w-full: the directory gives up all of its
              width before the filename loses a character. */}
          <span className="min-w-0 max-w-full shrink-0 truncate text-foreground">{filename}</span>
          {directory ? (
            <span className="min-w-0 truncate text-muted-foreground">{directory}</span>
          ) : null}
          {change ? (
            <span className="ml-auto flex shrink-0 items-center gap-1 pl-2">
              <ChangeEntryStat entry={change} />
            </span>
          ) : null}
        </div>
      </FilePathCursorTooltip>
    </CommandItem>
  )
}
