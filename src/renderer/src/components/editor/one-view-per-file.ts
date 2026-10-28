import { useEffect } from 'react'
import { useAppStore } from '@/store'
import type { OpenFile } from '@/store/slices/editor'
import { closeTabKeepingReveal } from '@/lib/close-tab-keeping-reveal'

type ViewFile = Pick<OpenFile, 'id' | 'filePath' | 'worktreeId' | 'mode' | 'diffSource' | 'isDirty'>

type ViewState = {
  openFiles: readonly ViewFile[]
  editorDrafts: Record<string, unknown>
  unifiedTabsByWorktree: Record<
    string,
    readonly { entityId: string; groupId: string; contentType: string }[]
  >
  pendingEditorReveal: unknown
  setPendingEditorReveal: (reveal: never) => void
  closeFile: (fileId: string) => void
}

const WORKING_DIFF_SOURCES = new Set(['unstaged', 'staged', 'branch', 'branch-worktree'])

function viewKind(file: ViewFile): 'edit' | 'diff' | null {
  if (file.mode === 'edit') {
    return 'edit'
  }
  return file.mode === 'diff' && file.diffSource && WORKING_DIFF_SOURCES.has(file.diffSource)
    ? 'diff'
    : null
}

// Fork: a file's editor and its working diff are one tab's two views, so opening one in a group
// closes the other there, unless it holds unsaved edits or is also open in another group.
export function closeOtherViewOfFile(state: ViewState, fileId: string, groupId: string): void {
  const active = state.openFiles.find((file) => file.id === fileId)
  const activeKind = active ? viewKind(active) : null
  if (!active || !activeKind) {
    return
  }
  const tabs = (state.unifiedTabsByWorktree[active.worktreeId] ?? []).filter(
    (tab) => tab.contentType === 'editor'
  )
  for (const file of state.openFiles) {
    const kind = viewKind(file)
    const fileTabs = tabs.filter((tab) => tab.entityId === file.id)
    if (
      file.id === fileId ||
      file.worktreeId !== active.worktreeId ||
      file.filePath !== active.filePath ||
      kind === null ||
      kind === activeKind ||
      file.isDirty ||
      state.editorDrafts[file.id] !== undefined ||
      fileTabs.length === 0 ||
      fileTabs.some((tab) => tab.groupId !== groupId)
    ) {
      continue
    }
    closeTabKeepingReveal(state, file.id)
  }
}

export function useOneViewPerFile(fileId: string | null, groupId: string | null): void {
  useEffect(() => {
    if (fileId && groupId) {
      closeOtherViewOfFile(useAppStore.getState(), fileId, groupId)
    }
  }, [fileId, groupId])
}
