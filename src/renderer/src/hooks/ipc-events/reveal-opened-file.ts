import { useAppStore } from '@/store'
import type { RuntimeFileReveal } from '../../../../shared/runtime-file-reveal'

// Fork: `orca file open --line` lands on the line the way a terminal file link does.
export function revealOpenedFile(
  worktreeId: string,
  filePath: string,
  language: string,
  reveal: RuntimeFileReveal
): void {
  const store = useAppStore.getState()
  const fileId = store.activeFileIdByWorktree[worktreeId] ?? filePath
  if (language === 'markdown') {
    // Why: rich Markdown has no line-based reveal consumer; a line target must mount Monaco.
    store.setMarkdownViewMode(fileId, 'source')
  }
  store.setPendingEditorReveal(null)
  // Why two frames: the tab's editor mounts after the open commits, and the reveal must find it.
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      useAppStore.getState().setPendingEditorReveal({
        filePath,
        fileId,
        line: reveal.line,
        column: reveal.column ?? 1,
        matchLength: 0
      })
    )
  )
}
