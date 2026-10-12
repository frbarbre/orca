import { joinPath } from '@/lib/path'
import type { EditorGet, EditorSet } from '../types/editor-set-get'
import type { EditorSlice } from '../types/editor-slice'
import type { OpenFile } from '../types/open-file'
import { buildDiffEditorFileId, withDiffContentReloadRequest } from '../file-ids/editor-file-ids'
import { resolveDiffRuntimeEnvironmentId } from '../git/diff-runtime-owner'
import { toBranchCompareSnapshot } from '../git/git-status-reconciliation'
import {
  buildEditorActiveResult,
  resolveEditorOpenTargetGroupId
} from '../tabs/editor-open-target-group'
import { resolveEditorPreviewIntent } from '../tabs/editor-preview-tab-setting'
import {
  getReplaceablePreviewFileId,
  openWorkspaceEditorItem,
  removeEditorStateForReplacedPreview
} from '../tabs/workspace-editor-item'

// Fork: the all-changes list opens each file from the branch base to what is on disk now. One tab
// per path, keyed like an unstaged diff, so a newer compare reuses it instead of stacking tabs.
export function createOpenBranchWorktreeDiff(
  set: EditorSet,
  get: EditorGet
): Pick<EditorSlice, 'openBranchWorktreeDiff'> {
  return {
    openBranchWorktreeDiff: (worktreeId, worktreePath, entry, compare, language, options) => {
      const branchCompare = toBranchCompareSnapshot(compare)
      const isPreview = resolveEditorPreviewIntent(get(), options?.preview)
      let editorItemTargetGroupId = options?.targetGroupId
      let editorItemFileId = ''
      set((s) => {
        const runtimeEnvironmentId = resolveDiffRuntimeEnvironmentId(
          s,
          worktreeId,
          options?.runtimeEnvironmentId
        )
        const id = buildDiffEditorFileId(
          worktreeId,
          'branch-worktree',
          entry.path,
          runtimeEnvironmentId
        )
        editorItemFileId = id
        const targetGroupId =
          resolveEditorOpenTargetGroupId(s, worktreeId, options?.targetGroupId) ?? undefined
        editorItemTargetGroupId = targetGroupId
        const activeResult = buildEditorActiveResult(s, worktreeId, id)
        const existing = s.openFiles.find((f) => f.id === id)
        if (existing) {
          const reopened = withDiffContentReloadRequest({
            ...existing,
            branchCompare,
            branchOldPath: entry.oldPath,
            isPreview: isPreview ? existing.isPreview : false,
            runtimeEnvironmentId
          })
          return {
            openFiles: s.openFiles.map((f) => (f.id === id ? reopened : f)),
            ...activeResult
          }
        }
        const newFile: OpenFile = {
          id,
          filePath: joinPath(worktreePath, entry.path),
          relativePath: entry.path,
          worktreeId,
          language,
          isDirty: false,
          mode: 'diff',
          diffSource: 'branch-worktree',
          branchCompare,
          branchOldPath: entry.oldPath,
          isPreview: isPreview || undefined,
          runtimeEnvironmentId
        }
        const replaceablePreviewId = isPreview
          ? getReplaceablePreviewFileId(s, worktreeId, targetGroupId)
          : null
        const replaceableIndex = s.openFiles.findIndex((file) => file.id === replaceablePreviewId)
        if (replaceableIndex !== -1) {
          return {
            openFiles: s.openFiles.map((file, index) =>
              index === replaceableIndex ? newFile : file
            ),
            ...removeEditorStateForReplacedPreview(s, s.openFiles[replaceableIndex], id),
            ...activeResult
          }
        }
        return { openFiles: [...s.openFiles, newFile], ...activeResult }
      })
      void openWorkspaceEditorItem(
        get(),
        editorItemFileId,
        worktreeId,
        entry.path,
        'diff',
        isPreview,
        editorItemTargetGroupId
      )
    }
  }
}
