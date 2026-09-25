import type { KeybindingActionId } from '../../../shared/keybindings'
import { useAppStore } from '../store'
import {
  ORCA_EDITOR_REQUEST_CMD_SAVE_EVENT,
  type EditorRequestCmdSaveDetail
} from './editor/editor-autosave'
import { getEditorCmdSaveFileId } from './editor/editor-cmd-save-target'
import { isEventTargetInsideFloatingWorkspacePanel } from '@/lib/floating-workspace-terminal-actions'
import { getOpenInSelection, resolveOpenInPath } from '@/lib/open-in-selection'
import { openWorktreePath } from '../components/sidebar/WorktreeOpenInMenu'

type EditorShortcutContext = {
  event: KeyboardEvent
  floatingWorkspaceFocused: boolean
  matchShortcut: (actionId: KeybindingActionId) => boolean
  notifyTerminalCapture: (actionId: KeybindingActionId) => void
}

// Returns true only when the chord was consumed, so unclaimed editor chords still
// fall through to the remaining workspace shortcuts.
export function handleTerminalWorkspaceEditorShortcut({
  event,
  floatingWorkspaceFocused,
  matchShortcut,
  notifyTerminalCapture
}: EditorShortcutContext): boolean {
  // Save active editor file — fallback for when focus is outside the editor (tab bar/sidebar); editor-local handlers own save when the editor is focused.
  if (!event.repeat && matchShortcut('editor.save')) {
    const target = event.target as HTMLElement | null
    const inEditor =
      target?.closest('.monaco-editor, [contenteditable]') !== null ||
      target?.closest('textarea:not(.xterm-helper-textarea), input') !== null
    if (!inEditor) {
      const state = useAppStore.getState()
      const floatingPanelOwnsEvent =
        isEventTargetInsideFloatingWorkspacePanel(event.target) || floatingWorkspaceFocused
      const requestedFileId = getEditorCmdSaveFileId(state, floatingPanelOwnsEvent)
      if (requestedFileId) {
        event.preventDefault()
        notifyTerminalCapture('editor.save')
        window.dispatchEvent(
          new CustomEvent<EditorRequestCmdSaveDetail>(ORCA_EDITOR_REQUEST_CMD_SAVE_EVENT, {
            detail: { fileId: requestedFileId }
          })
        )
        return true
      }
    }
  }
  // Opens the selected file — or the worktree when nothing is selected — in the first configured
  // "Open in" application, which is the one the user put at the top as their preferred editor.
  if (!event.repeat && matchShortcut('editor.openInExternalApp')) {
    const state = useAppStore.getState()
    const worktree = state.activeWorktreeId
      ? state.getKnownWorktreeById(state.activeWorktreeId)
      : null
    const preferred = state.settings?.openInApplications?.[0]
    if (worktree?.path && preferred) {
      event.preventDefault()
      notifyTerminalCapture('editor.openInExternalApp')
      void openWorktreePath({
        target: 'external-editor',
        worktreePath: resolveOpenInPath({
          tab: state.rightSidebarTab,
          worktreePath: worktree.path,
          explorerPath: getOpenInSelection('explorer'),
          sourceControlPath: getOpenInSelection('source-control')
        }),
        connectionId: state.repos.find((repo) => repo.id === worktree.repoId)?.connectionId ?? null,
        command: preferred.command
      })
      return true
    }
  }
  // Why: long/structured files need a discoverable unwrap path without Settings (#9974).
  if (!event.repeat && matchShortcut('editor.toggleWordWrap')) {
    const state = useAppStore.getState()
    if (state.activeTabType === 'editor' && state.activeFileId) {
      event.preventDefault()
      notifyTerminalCapture('editor.toggleWordWrap')
      // Why: diff surfaces use diffWordWrap; plain editors use editorWordWrap (#10086).
      const activeFile = state.openFiles.find((file) => file.id === state.activeFileId)
      if (activeFile?.mode === 'diff') {
        const wrapOn = state.settings?.diffWordWrap === true
        void state.updateSettings({ diffWordWrap: !wrapOn })
      } else {
        const wrapOn = state.settings?.editorWordWrap !== false
        void state.updateSettings({ editorWordWrap: !wrapOn })
      }
      return true
    }
  }
  return false
}
