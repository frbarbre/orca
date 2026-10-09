import { shell } from 'electron'

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

export function installClaudeWebExternalLinks(guest: Electron.WebContents): void {
  guest.setWindowOpenHandler(({ url }) =>
    handleClaudeWebWindowOpen(url, (target) => void shell.openExternal(target))
  )
}
