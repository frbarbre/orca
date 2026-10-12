import {
  isWebviewDragPassthroughActive,
  registerWebviewDragPassthroughSurface
} from '@/components/browser-pane/host-guest/webview-drag-passthrough'
import { CLAUDE_WEB_COVER_ATTRIBUTE } from './claude-web-covered-pane'

function coverHoldsFocus(webview: HTMLElement): boolean {
  const cover = webview.closest(`[${CLAUDE_WEB_COVER_ATTRIBUTE}]`)
  return cover !== null && cover === webview.ownerDocument.activeElement
}

// Fork: the Claude page is a <webview> outside the browser-tab registry, so it enrols itself.
// Without it a tab drag over the page loses the pointer to the guest, and the window blur that
// follows ends the drag with the tab dropped nowhere.
export function enrolClaudeWebviewInDragPassthrough(webview: HTMLElement): () => void {
  const apply = (passthrough: boolean): void => {
    webview.style.pointerEvents = passthrough ? 'none' : ''
    // Why: focus held back mid-drag (see focusClaudeWebview) lands once the drag is over.
    if (!passthrough && coverHoldsFocus(webview)) {
      webview.focus()
    }
  }
  if (isWebviewDragPassthroughActive()) {
    webview.style.pointerEvents = 'none'
  }
  return registerWebviewDragPassthroughSurface(apply)
}

// Why the drag gate: a tab drag preview-activates whatever it hovers, and focusing the guest hands
// focus to another WebContents; the embedder blur that follows reads as an aborted drag.
export function focusClaudeWebview(webview: HTMLElement): void {
  if (isWebviewDragPassthroughActive()) {
    return
  }
  webview.focus()
}
