import React from 'react'
import { CornerDownRight } from 'lucide-react'
import { CommandItem } from '@/components/ui/command'
import { splitTrailingSegment } from '@/components/file-path-cursor-tooltip'
import { getFileTypeIcon } from '@/lib/file-type-icons'
import { translate } from '@/i18n/i18n'
import { quickOpenTextMatchPreview, type QuickOpenTextRow } from './quick-open-modes'

export const QUICK_OPEN_GO_TO_LINE_VALUE = 'go-to-line'

export function QuickOpenTextItems({
  rows,
  disabled,
  onSelect
}: {
  rows: readonly QuickOpenTextRow[]
  disabled: boolean
  onSelect: (row: QuickOpenTextRow) => void
}): React.JSX.Element {
  return (
    <>
      {rows.map((row) => {
        if (row.kind === 'file') {
          const { directory, filename } = splitTrailingSegment(row.relativePath)
          const FileIcon = getFileTypeIcon(row.relativePath)
          return (
            <CommandItem
              key={row.key}
              value={row.key}
              disabled={disabled}
              onSelect={() => onSelect(row)}
              className="mt-1 min-w-0 !p-0 first:mt-0"
            >
              <div className="flex w-full min-w-0 items-center gap-2 px-3 py-1">
                <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 max-w-full shrink-0 truncate font-medium text-foreground">
                  {filename}
                </span>
                {directory ? (
                  <span className="min-w-0 truncate text-muted-foreground">{directory}</span>
                ) : null}
                <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                  {row.matchCount}
                </span>
              </div>
            </CommandItem>
          )
        }
        const preview = quickOpenTextMatchPreview(row)
        return (
          <CommandItem
            key={row.key}
            value={row.key}
            disabled={disabled}
            onSelect={() => onSelect(row)}
            className="min-w-0 !p-0"
          >
            <div className="flex w-full min-w-0 items-baseline gap-2 py-0.5 pr-3 pl-8">
              <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                {row.line}
              </span>
              <span className="min-w-0 truncate whitespace-pre text-xs">
                <span className="text-muted-foreground">{preview.before}</span>
                {preview.match ? (
                  <span className="rounded-sm bg-amber-500/30 text-foreground">
                    {preview.match}
                  </span>
                ) : null}
                <span className="text-muted-foreground">{preview.after}</span>
              </span>
            </div>
          </CommandItem>
        )
      })}
    </>
  )
}

export function QuickOpenGoToLineItem({
  relativePath,
  line,
  column,
  onSelect
}: {
  relativePath: string
  line: number
  column?: number
  onSelect: () => void
}): React.JSX.Element {
  return (
    <CommandItem value={QUICK_OPEN_GO_TO_LINE_VALUE} onSelect={onSelect} className="min-w-0 !p-0">
      <div className="flex w-full min-w-0 items-center gap-2 px-3 py-1">
        <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 text-foreground">
          {column === undefined
            ? translate('quickOpen.goToLine', 'Go to line {{line}}', { line })
            : translate('quickOpen.goToLineColumn', 'Go to line {{line}}, column {{column}}', {
                line,
                column
              })}
        </span>
        <span className="min-w-0 truncate text-muted-foreground">{relativePath}</span>
      </div>
    </CommandItem>
  )
}
