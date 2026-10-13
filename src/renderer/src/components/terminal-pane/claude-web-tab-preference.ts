const preferenceByTabId = new Map<string, boolean>()

/** Fork: a launcher's say on one tab, over the "Open Claude in Claude web" default. */
export function preferClaudeWebForTab(tabId: string, openInWebView: boolean): void {
  preferenceByTabId.set(tabId, openInWebView)
}

export function claudeWebPreferenceForTab(tabId: string): boolean | null {
  return preferenceByTabId.get(tabId) ?? null
}

export function resetClaudeWebTabPreferencesForTests(): void {
  preferenceByTabId.clear()
}
