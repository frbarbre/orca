import { useAppStore } from '@/store'
import { activateCyclableTab } from '@/hooks/ipc-tab-switch'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import type { TypeCyclableTab } from '@/components/terminal/tab-type-cycle'
import type { Tab } from '../../../../shared/tab-types'
import type { FocusDirection } from '../../../../shared/keybindings/directional-group-focus'
import { findRectInDirection, type RectBounds } from './find-rect-in-direction'

export type GroupFocusOutcome = 'moved' | 'edge' | 'single-group'

const GROUP_BODY_SELECTOR = '[data-tab-group-body-id]'
const FOCUSABLE_CONTENT_SELECTOR =
  'textarea, input, [contenteditable="true"], webview, iframe, [tabindex]:not([tabindex="-1"])'

function isVisible(element: Element): boolean {
  const { width, height } = element.getBoundingClientRect()
  return width > 0 && height > 0
}

function visibleGroupBodies(worktreeId: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(GROUP_BODY_SELECTOR)].filter(
    (body) => body.dataset.worktreeId === worktreeId && isVisible(body)
  )
}

function toCyclableTab(tab: Tab): TypeCyclableTab {
  switch (tab.contentType) {
    case 'terminal':
    case 'browser':
    case 'agent-session':
      return { type: tab.contentType, id: tab.entityId, tabId: tab.id }
    case 'simulator':
      return { type: 'simulator', id: tab.id, tabId: tab.id }
    case 'editor':
    case 'diff':
    case 'conflict-review':
    case 'check-details':
    case 'chat-visual':
      return { type: 'editor', id: tab.entityId, tabId: tab.id }
  }
}

function centerWithin(element: Element, rect: RectBounds): boolean {
  const box = element.getBoundingClientRect()
  const x = box.left + box.width / 2
  const y = box.top + box.height / 2
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

// Why geometry: terminals, browsers and chats render in overlay layers above the group body, not inside it.
function groupRectAt(element: Element | null, rects: readonly RectBounds[]): RectBounds | null {
  if (!element || element === document.body) {
    return null
  }
  return rects.find((rect) => centerWithin(element, rect)) ?? null
}

function focusGroupContent(target: RectBounds): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (groupRectAt(document.activeElement, [target])) {
        return
      }
      const content = [...document.querySelectorAll<HTMLElement>(FOCUSABLE_CONTENT_SELECTOR)].find(
        (element) => isVisible(element) && centerWithin(element, target)
      )
      if (content) {
        content.focus()
        return
      }
      // Why: an empty group still has to take focus, or the group we left reclaims it on blur.
      const body = [...document.querySelectorAll<HTMLElement>(GROUP_BODY_SELECTOR)].find(
        (candidate) => candidate.dataset.tabGroupBodyId === target.id
      )
      if (body) {
        if (!body.hasAttribute('tabindex')) {
          body.tabIndex = -1
        }
        body.focus({ preventScroll: true })
      }
    })
  })
}

function focusTabGroup(worktreeId: string, target: RectBounds): void {
  const groupId = target.id
  const state = useAppStore.getState()
  const group = (state.groupsByWorktree[worktreeId] ?? []).find((g) => g.id === groupId)
  const tab = group?.activeTabId
    ? (state.unifiedTabsByWorktree[worktreeId] ?? []).find((t) => t.id === group.activeTabId)
    : undefined
  if (!tab) {
    state.focusGroup(worktreeId, groupId)
    focusGroupContent(target)
    return
  }
  activateCyclableTab(state, toCyclableTab(tab))
  if (tab.contentType === 'terminal') {
    focusTerminalTabSurface(
      tab.entityId,
      state.terminalLayoutsByTabId[tab.entityId]?.activeLeafId ?? null
    )
  }
  focusGroupContent(target)
}

export function focusTabGroupInDirection(direction: FocusDirection): GroupFocusOutcome {
  const state = useAppStore.getState()
  const worktreeId = state.activeWorktreeId
  if (!worktreeId) {
    return 'single-group'
  }
  const bodies = visibleGroupBodies(worktreeId)
  if (bodies.length < 2) {
    return 'single-group'
  }
  const rects: RectBounds[] = bodies.map((body) => {
    const { left, top, right, bottom } = body.getBoundingClientRect()
    return { id: body.dataset.tabGroupBodyId ?? '', left, top, right, bottom }
  })
  const activeId =
    groupRectAt(document.activeElement, rects)?.id ??
    state.activeGroupIdByWorktree[worktreeId] ??
    rects[0].id
  const target = rects.find((rect) => rect.id === findRectInDirection(rects, activeId, direction))
  if (!target) {
    return 'edge'
  }
  focusTabGroup(worktreeId, target)
  return 'moved'
}
