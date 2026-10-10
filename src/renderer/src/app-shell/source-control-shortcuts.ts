import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { openLatestAgentTurn } from '@/lib/agent-turn-open'
import { useAppStore } from '../store'
import type { KeybindingActionId } from '../../../shared/keybindings/types'

type SourceControlShortcutId = 'sourceControl.sendReviewNotes' | 'sourceControl.openLatestAgentTurn'

function startOpenLatestAgentTurn(): boolean {
  const store = useAppStore.getState()
  const worktreeId = store.activeWorktreeId
  const worktreePath = worktreeId ? store.getKnownWorktreeById(worktreeId)?.path : undefined
  if (!worktreeId || !worktreePath || !window.api?.agentTurns) {
    return false
  }
  void openLatestAgentTurn(worktreeId, worktreePath, {
    listTurns: window.api.agentTurns.list,
    commitCompare: window.api.git.commitCompare,
    openCommitAllDiffs: store.openCommitAllDiffs
  })
    .then((opened) => {
      if (!opened) {
        toast.info(translate('agentTurns.none', 'No agent turns in this workspace yet.'))
      }
    })
    .catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : String(error))
    })
  return true
}

// Returns the shortcut that took the chord, so the caller can stop the key reaching a terminal.
export function takeSourceControlShortcut(
  matchShortcut: (actionId: KeybindingActionId) => boolean,
  canRevealRightSidebar: boolean,
  actions: { openDiffNotesSendMenuForActiveWorktree: () => boolean }
): SourceControlShortcutId | null {
  // Unbound by default, so it runs after the built-in alias handlers; only consumes the chord when the active worktree has unsent notes.
  if (
    canRevealRightSidebar &&
    matchShortcut('sourceControl.sendReviewNotes') &&
    actions.openDiffNotesSendMenuForActiveWorktree()
  ) {
    return 'sourceControl.sendReviewNotes'
  }
  // Fork: open the active workspace's newest agent turn.
  if (matchShortcut('sourceControl.openLatestAgentTurn') && startOpenLatestAgentTurn()) {
    return 'sourceControl.openLatestAgentTurn'
  }
  return null
}
