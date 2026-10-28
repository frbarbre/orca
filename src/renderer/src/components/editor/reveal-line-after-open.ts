import { useAppStore } from '@/store'

// Why two frames: opening can swap the active tab and mount Monaco before it can reveal a line.
export function revealLineAfterOpen(filePath: string, line: number): void {
  useAppStore.getState().setPendingEditorReveal(null)
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      useAppStore.getState().setPendingEditorReveal({ filePath, line, column: 1, matchLength: 0 })
    )
  )
}
