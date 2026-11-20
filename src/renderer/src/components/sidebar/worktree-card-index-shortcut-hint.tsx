import React from 'react'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { useWorkspaceIndexShortcutKeys } from './workspace-index-shortcut-hint'

export function WorktreeCardIndexShortcutHint({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const keys = useWorkspaceIndexShortcutKeys(worktreeId)
  if (!keys) {
    return null
  }
  return (
    <ShortcutKeyCombo
      keys={keys}
      className="ml-auto shrink-0 gap-0.5 pr-1.5"
      separatorClassName="text-3xs text-muted-foreground"
      keyCapClassName="min-w-4 px-1 py-0 text-3xs leading-4"
    />
  )
}
