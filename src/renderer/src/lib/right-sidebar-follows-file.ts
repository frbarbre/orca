import type { ActiveRightSidebarTab } from '../../../shared/ui-chrome-types'
import { useAppStore } from '@/store'

export type ActiveFileKind = 'diff' | 'file'

type FileKindState = {
  activeFileId: string | null
  activeTabType: string
  openFiles: readonly { id: string; mode: string }[]
  editorViewMode: Record<string, string | undefined>
}

const DIFF_MODES = new Set(['diff', 'conflict-review'])
const FILE_MODES = new Set(['edit', 'markdown-preview'])

export function activeFileKind(state: FileKindState): ActiveFileKind | null {
  if (state.activeTabType !== 'editor' || !state.activeFileId) {
    return null
  }
  const file = state.openFiles.find((candidate) => candidate.id === state.activeFileId)
  if (!file) {
    return null
  }
  if (DIFF_MODES.has(file.mode) || state.editorViewMode[file.id] === 'changes') {
    return 'diff'
  }
  return FILE_MODES.has(file.mode) ? 'file' : null
}

// Why only on a change of kind: a panel the user picked stays until a diff gives way to a file or back.
export function panelForFileKindChange(
  previous: ActiveFileKind | null,
  next: ActiveFileKind | null,
  currentTab: ActiveRightSidebarTab
): ActiveRightSidebarTab | null {
  if (!previous || !next || previous === next) {
    return null
  }
  const panel = next === 'diff' ? 'source-control' : 'explorer'
  return panel === currentTab ? null : panel
}

// Fork: the right sidebar shows source control for a diff and the explorer for a file.
export function installRightSidebarFollowsFile(): void {
  let lastKind = activeFileKind(useAppStore.getState())
  useAppStore.subscribe((state, previous) => {
    if (
      state.activeFileId === previous.activeFileId &&
      state.activeTabType === previous.activeTabType &&
      state.openFiles === previous.openFiles &&
      state.editorViewMode === previous.editorViewMode
    ) {
      return
    }
    const kind = activeFileKind(state)
    if (!kind) {
      return
    }
    const panel = panelForFileKindChange(lastKind, kind, state.rightSidebarTab)
    lastKind = kind
    if (panel) {
      state.setRightSidebarTab(panel)
    }
  })
}
