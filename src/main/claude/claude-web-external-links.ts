// Fork: claude.ai opens links (Linear, GitHub, …) in a new tab, and a <webview> drops new windows
// unless the host handles them; send http(s) ones to the default browser, nothing else to the OS.
export function handleClaudeWebWindowOpen(
  url: string,
  openExternal: (url: string) => void
): { action: 'deny' } {
  if (/^https?:\/\//i.test(url)) {
    openExternal(url)
  }
  return { action: 'deny' }
}

// Why openExternal is passed in: this module is reachable from the headless runtime, which has no Electron.
export function installClaudeWebExternalLinks(
  guest: Electron.WebContents,
  openExternal: (url: string) => void
): void {
  guest.setWindowOpenHandler(({ url }) => handleClaudeWebWindowOpen(url, openExternal))
}
