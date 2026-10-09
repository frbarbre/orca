import { create } from 'zustand'
import { detectLanguage } from '@/lib/language-detect'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import {
  EMPTY_CODE_HISTORY,
  recordJump,
  stepCodeHistory,
  type CodeHistory,
  type CodeLocation
} from './code-navigation-history'
import { replaceableTabId, targetHasDiff } from './language-server-editor'

export const useCodeHistory = create<{ history: CodeHistory }>(() => ({
  history: EMPTY_CODE_HISTORY
}))

export function canGoBackInCode(state: { history: CodeHistory }): boolean {
  return state.history.index > 0
}

export function canGoForwardInCode(state: { history: CodeHistory }): boolean {
  return state.history.index < state.history.entries.length - 1
}

let readCurrentLocation: () => CodeLocation | null = () => null

export function setCurrentCodeLocationReader(reader: () => CodeLocation | null): void {
  readCurrentLocation = reader
}

// Why replace the tab: a jump moves the tab the user is reading, as in VS Code, instead of
// stacking a new tab per definition.
function showLocation(location: CodeLocation, leaving: CodeLocation | null): void {
  const store = useAppStore.getState()
  const replacedTabId = leaving ? replaceableTabId(store, leaving, location.filePath) : null
  activateAndRevealWorktree(location.worktreeId, { providesInitialSurface: true })
  const { line, column } = location
  if (
    location.inDiff &&
    location.relativePath !== location.filePath &&
    targetHasDiff(store, location.worktreeId, location.relativePath)
  ) {
    store.openDiffAtLocation({
      worktreeId: location.worktreeId,
      worktreePath: location.worktreeRoot,
      relativePath: location.relativePath,
      line,
      preview: false
    })
  } else {
    store.openFile(
      {
        filePath: location.filePath,
        relativePath: location.relativePath,
        worktreeId: location.worktreeId,
        language: detectLanguage(location.relativePath),
        mode: 'edit'
      },
      { forceContentReload: true }
    )
    store.setPendingEditorReveal(null)
    // Why two frames: opening can swap the active tab and mount Monaco before it can reveal a line.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        useAppStore.getState().setPendingEditorReveal({
          filePath: location.filePath,
          line,
          column,
          matchLength: 0
        })
      )
    )
  }
  if (replacedTabId) {
    useAppStore.getState().closeFile(replacedTabId)
  }
}

export function recordCodeJump(from: CodeLocation, to: CodeLocation): void {
  useCodeHistory.setState(({ history }) => ({ history: recordJump(history, from, to) }))
}

export function jumpToCode(from: CodeLocation, to: CodeLocation): void {
  recordCodeJump(from, to)
  showLocation(to, from)
}

export function goInCodeHistory(direction: 'back' | 'forward'): void {
  const { history } = useCodeHistory.getState()
  const step = stepCodeHistory(history, direction, readCurrentLocation())
  if (!step) {
    return
  }
  const leaving = step.history.entries[history.index] ?? null
  useCodeHistory.setState({ history: step.history })
  showLocation(step.location, leaving)
}
