import React from 'react'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import { STATUS_COLORS, STATUS_LABELS } from '../../status-display'
import { DiffLineCounts } from './diff-line-counts'

export function ChangeEntryStat({
  entry
}: {
  entry: Pick<GitBranchChangeEntry, 'status' | 'added' | 'removed'>
}): React.JSX.Element {
  return (
    <>
      <DiffLineCounts added={entry.added} removed={entry.removed} />
      <span
        className="w-4 shrink-0 text-center text-[10px] font-bold"
        style={{ color: STATUS_COLORS[entry.status] }}
      >
        {STATUS_LABELS[entry.status]}
      </span>
    </>
  )
}
