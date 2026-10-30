import { translate } from '@/i18n/i18n'

// Fork: titles for the fork's own shortcut actions, spread into upstream's STATIC_TITLE_COPY.
export const FORK_KEYBINDING_TITLE_COPY = {
  'tab.runQuickCommand': () =>
    translate('keybindings.title.tabRunQuickCommand', 'Run the selected quick command'),
  'tab.closeOthers': () => translate('keybindings.title.tabCloseOthers', 'Close other tabs'),
  'tabGroup.focusLeft': () =>
    translate('keybindings.title.tabGroupFocusLeft', 'Focus group to the left'),
  'tabGroup.focusRight': () =>
    translate('keybindings.title.tabGroupFocusRight', 'Focus group to the right'),
  'tabGroup.focusUp': () => translate('keybindings.title.tabGroupFocusUp', 'Focus group above'),
  'tabGroup.focusDown': () => translate('keybindings.title.tabGroupFocusDown', 'Focus group below'),
  'editor.previousFile': () =>
    translate('keybindings.title.editorPreviousFile', 'Go to Previous Changed File'),
  'editor.nextFile': () => translate('keybindings.title.editorNextFile', 'Go to Next Changed File'),
  'editor.showEdit': () => translate('keybindings.title.editorShowEdit', 'Show File Editor'),
  'editor.showDiff': () => translate('keybindings.title.editorShowDiff', 'Show File Diff'),
  'editor.openInExternalApp': () =>
    translate('keybindings.title.editorOpenInExternalApp', 'Open in External App'),
  'sourceControl.openLatestAgentTurn': () =>
    translate('keybindings.title.sourceControlOpenLatestAgentTurn', 'Open Latest Agent Turn'),
  'sourceControl.toggleUncommittedOnly': () =>
    translate(
      'keybindings.title.sourceControlToggleUncommittedOnly',
      'Show Only Uncommitted Changes'
    ),
  'sourceControl.sendQueuedComments': () =>
    translate('keybindings.title.sourceControlSendQueuedComments', 'Send Queued Comments'),
  'sourceControl.focusReviewSummary': () =>
    translate('keybindings.title.sourceControlFocusReviewSummary', 'Focus Review Summary'),
  'sourceControl.openPullRequest': () =>
    translate('keybindings.title.sourceControlOpenPullRequest', 'Open Pull Request on GitHub'),
  'sourceControl.copyPullRequestUrl': () =>
    translate('keybindings.title.sourceControlCopyPullRequestUrl', 'Copy Pull Request URL'),
  'sourceControl.openPullRequestPreview': () =>
    translate(
      'keybindings.title.sourceControlOpenPullRequestPreview',
      'Open Pull Request Preview Deployment'
    ),
  'workspace.openFrontend': () =>
    translate('keybindings.title.workspaceOpenFrontend', 'Open Frontend Dev Server'),
  'workspace.openLinearIssue': () =>
    translate('keybindings.title.workspaceOpenLinearIssue', 'Open Linear Issue in Browser'),
  'workspace.runNextAction': () =>
    translate('keybindings.title.workspaceRunNextAction', 'Run Next Workspace Action'),
  'workspace.review': () => translate('keybindings.title.workspaceReview', 'Review Pull Request')
} as const
