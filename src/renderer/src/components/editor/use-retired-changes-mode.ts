import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { showFileDiff } from './file-tab-view-switch'

// Fork: Changes is the file's diff tab now, so a tab still asking for the old in-place view
// (restored state, or a fallback that sets it) is handed that tab instead.
export function useRetiredChangesMode(fileId: string | null): void {
  useEffect(() => {
    if (!fileId) {
      return
    }
    useAppStore.getState().setEditorViewMode(fileId, 'edit')
    void showFileDiff(fileId)
  }, [fileId])
}
