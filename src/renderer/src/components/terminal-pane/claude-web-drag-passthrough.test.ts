// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { acquireWebviewsDragPassthrough } from '@/components/browser-pane/host-guest/webview-drag-passthrough'
import {
  enrolClaudeWebviewInDragPassthrough,
  focusClaudeWebview
} from './claude-web-drag-passthrough'
import { CLAUDE_WEB_COVER_ATTRIBUTE } from './claude-web-covered-pane'

function coveredWebview(): { cover: HTMLElement; webview: HTMLElement } {
  const cover = document.createElement('div')
  cover.tabIndex = -1
  cover.setAttribute(CLAUDE_WEB_COVER_ATTRIBUTE, '')
  const webview = document.createElement('button')
  cover.appendChild(webview)
  document.body.appendChild(cover)
  return { cover, webview }
}

describe('focusClaudeWebview', () => {
  it('holds the page off focus during a tab drag, which would read as the drag ending', () => {
    const { cover, webview } = coveredWebview()
    const unenrol = enrolClaudeWebviewInDragPassthrough(webview)
    const release = acquireWebviewsDragPassthrough()
    cover.focus()
    focusClaudeWebview(webview)
    expect(document.activeElement).toBe(cover)

    release()
    expect(document.activeElement).toBe(webview)
    unenrol()
    cover.remove()
  })

  it('focuses the page at once outside a drag', () => {
    const { cover, webview } = coveredWebview()
    focusClaudeWebview(webview)
    expect(document.activeElement).toBe(webview)
    cover.remove()
  })
})

describe('enrolClaudeWebviewInDragPassthrough', () => {
  it('lets a tab drag pass over the Claude page instead of the page taking the pointer', () => {
    const webview = document.createElement('div')
    const unenrol = enrolClaudeWebviewInDragPassthrough(webview)
    const release = acquireWebviewsDragPassthrough()
    expect(webview.style.pointerEvents).toBe('none')
    release()
    expect(webview.style.pointerEvents).toBe('')
    unenrol()
  })

  it('is click-through at once when it appears during a drag, and stops following drags once gone', () => {
    const release = acquireWebviewsDragPassthrough()
    const webview = document.createElement('div')
    const unenrol = enrolClaudeWebviewInDragPassthrough(webview)
    expect(webview.style.pointerEvents).toBe('none')
    unenrol()
    release()
    expect(webview.style.pointerEvents).toBe('none')
  })
})
