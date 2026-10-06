import type { PaneManager } from '@/lib/pane-manager/pane-manager'

export const CLAUDE_WEB_COVER_ATTRIBUTE = 'data-claude-web-cover'

// Why: refocusing a pane under the web view hands the page the keyboard, which blurs Orca's
// window mid-press and cancels a tab click; Chromium restores the page's own focus anyway.
export function activePaneIsCoveredByClaudeWeb(manager: PaneManager): boolean {
  const pane = manager.getActivePane() ?? manager.getPanes()[0]
  return pane?.container.querySelector(`[${CLAUDE_WEB_COVER_ATTRIBUTE}]`) != null
}
