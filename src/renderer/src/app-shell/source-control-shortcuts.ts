import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { openLatestAgentTurn } from '@/lib/agent-turn-open'
import { clearChangesFilter, getChangesFilter, toggleUncommittedOnly } from '@/lib/changes-filter'
import { showInChanges } from '@/lib/show-in-changes'
import { sendQueuedPRCommentsForActiveWorktree } from '@/components/right-sidebar/queued-pr-comments-send'
import {
  hasReviewSummary,
  requestReviewSummaryFocus
} from '@/components/pending-review/review-summary-focus'
import { activeWorktreePullRequestUrl } from '@/lib/worktree-pull-request-url'
import { openActiveWorkspaceFrontend } from '@/lib/open-workspace-frontend'
import { useAppStore } from '../store'
import type { KeybindingActionId } from '../../../shared/keybindings/types'

type SourceControlShortcutId =
  | 'sourceControl.sendReviewNotes'
  | 'sourceControl.openLatestAgentTurn'
  | 'sourceControl.toggleUncommittedOnly'
  | 'sourceControl.sendQueuedComments'
  | 'sourceControl.focusReviewSummary'
  | 'sourceControl.openPullRequest'
  | 'sourceControl.copyPullRequestUrl'
  | 'workspace.openFrontend'

function focusReviewSummaryInOpenPanel(): boolean {
  const { activeWorktreeId, rightSidebarOpen, rightSidebarTab } = useAppStore.getState()
  if (
    !activeWorktreeId ||
    !rightSidebarOpen ||
    rightSidebarTab !== 'source-control' ||
    !hasReviewSummary(activeWorktreeId)
  ) {
    return false
  }
  requestReviewSummaryFocus(activeWorktreeId)
  return true
}

// Why up front: the latest turn only lands after its turn list and diff load.
function revealSourceControl(canRevealRightSidebar: boolean): void {
  if (!canRevealRightSidebar) {
    return
  }
  const store = useAppStore.getState()
  store.setRightSidebarOpen(true)
  store.setRightSidebarTab('source-control')
}

function startOpenLatestAgentTurn(): boolean {
  const store = useAppStore.getState()
  const worktreeId = store.activeWorktreeId
  const filter = worktreeId ? getChangesFilter(worktreeId) : null
  if (worktreeId && filter?.kind === 'turn' && filter.latest) {
    clearChangesFilter(worktreeId)
    return true
  }
  const worktreePath = worktreeId ? store.getKnownWorktreeById(worktreeId)?.path : undefined
  if (!worktreeId || !worktreePath || !window.api?.agentTurns) {
    return false
  }
  void openLatestAgentTurn(worktreeId, worktreePath, {
    listTurns: window.api.agentTurns.list,
    commitCompare: window.api.git.commitCompare,
    showInChanges
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
    revealSourceControl(canRevealRightSidebar)
    return 'sourceControl.openLatestAgentTurn'
  }
  const activeWorktreeId = useAppStore.getState().activeWorktreeId
  if (matchShortcut('sourceControl.toggleUncommittedOnly') && activeWorktreeId) {
    toggleUncommittedOnly(activeWorktreeId)
    revealSourceControl(canRevealRightSidebar)
    return 'sourceControl.toggleUncommittedOnly'
  }
  if (
    matchShortcut('sourceControl.sendQueuedComments') &&
    sendQueuedPRCommentsForActiveWorktree()
  ) {
    return 'sourceControl.sendQueuedComments'
  }
  if (matchShortcut('sourceControl.focusReviewSummary') && focusReviewSummaryInOpenPanel()) {
    return 'sourceControl.focusReviewSummary'
  }
  if (matchShortcut('workspace.openFrontend')) {
    if (!openActiveWorkspaceFrontend()) {
      toast.info(translate('workspace.frontend.notRunning', 'No frontend dev server is running.'))
    }
    return 'workspace.openFrontend'
  }
  if (matchShortcut('sourceControl.openPullRequest')) {
    withActivePullRequestUrl((url) => void window.api.shell.openUrl(url))
    return 'sourceControl.openPullRequest'
  }
  if (matchShortcut('sourceControl.copyPullRequestUrl')) {
    withActivePullRequestUrl((url) => {
      void window.api.ui
        .writeClipboardText(url)
        .then(() =>
          toast.success(translate('sourceControl.pullRequestUrlCopied', 'Copied pull request URL'))
        )
    })
    return 'sourceControl.copyPullRequestUrl'
  }
  return null
}

function withActivePullRequestUrl(act: (url: string) => void): void {
  const url = activeWorktreePullRequestUrl(useAppStore.getState())
  if (url) {
    act(url)
  } else {
    toast.info(translate('sourceControl.noPullRequest', 'This workspace has no pull request yet.'))
  }
}
