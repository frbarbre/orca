/**
 * The path each right-sidebar panel currently has selected, for the "open in external app" chord.
 *
 * Why a module registry rather than store state: the Explorer and the Source Control listing both
 * keep their selection in component-local hooks, and promoting either into the store would run
 * every selector in the app on each arrow-key press for a value no other component renders. The
 * panels publish here; the shortcut reads it imperatively, once, on the keystroke.
 */
export type OpenInSelectionSource = 'explorer' | 'source-control'

const selectionBySource = new Map<OpenInSelectionSource, string>()

export function setOpenInSelection(
  source: OpenInSelectionSource,
  absolutePath: string | null
): void {
  if (absolutePath) {
    selectionBySource.set(source, absolutePath)
    return
  }
  selectionBySource.delete(source)
}

export function getOpenInSelection(source: OpenInSelectionSource): string | null {
  return selectionBySource.get(source) ?? null
}

export function clearOpenInSelection(source: OpenInSelectionSource): void {
  selectionBySource.delete(source)
}

/**
 * The path the chord should open, given which panel the user is looking at.
 *
 * Why the tab decides: the two panels hold independent selections, and the one on screen is the one
 * the user means. With nothing selected there — or on any other tab — the worktree root is the
 * useful answer, since that opens the project rather than doing nothing.
 */
export function resolveOpenInPath(args: {
  tab: string
  worktreePath: string
  explorerPath: string | null
  sourceControlPath: string | null
}): string {
  if (args.tab === 'explorer' && args.explorerPath) {
    return args.explorerPath
  }
  if (args.tab === 'source-control' && args.sourceControlPath) {
    return args.sourceControlPath
  }
  return args.worktreePath
}
