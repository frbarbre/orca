import { useSyncExternalStore } from 'react'
import {
  canonicalizeParsedKeybinding,
  DIGIT_INDEX_KEY_PATTERN,
  formatKeybinding,
  getEffectiveKeybindingsForAction,
  parseKeybinding
} from '../../../../shared/keybindings'
import { addAppKeyListener, removeAppKeyListener } from '@/lib/app-keyboard-router'
import { getShortcutPlatform } from '@/lib/shortcut-platform'
import { useAppStore } from '@/store'
import { getVisibleWorktreeShortcutTargets } from './visible-worktrees'

// Why: a short hold keeps the hints from flashing on every Mod+C or Mod+S.
export const WORKSPACE_INDEX_SHORTCUT_HINT_DELAY_MS = 150
const MAX_DIGIT_INDEX = 9
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'OS'])

type HeldModifiers = Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

type HintSources = {
  getBindings: () => readonly string[]
  getPlatform: () => NodeJS.Platform
  getTargetIds: () => readonly string[]
  isEnabled: () => boolean
}

function bindingForHeldModifiers(
  bindings: readonly string[],
  held: HeldModifiers,
  platform: NodeJS.Platform
): string | null {
  const isMac = platform === 'darwin'
  for (const binding of bindings) {
    const parsed = parseKeybinding(binding)
    if (!parsed || parsed.doubleTapModifier || !DIGIT_INDEX_KEY_PATTERN.test(parsed.key)) {
      continue
    }
    const meta = parsed.meta || (parsed.mod && isMac)
    const ctrl = parsed.control || (parsed.mod && !isMac)
    if (
      (meta || ctrl || parsed.alt || parsed.shift) &&
      meta === held.metaKey &&
      ctrl === held.ctrlKey &&
      parsed.alt === held.altKey &&
      parsed.shift === held.shiftKey
    ) {
      return binding
    }
  }
  return null
}

function keysByTarget(
  binding: string,
  targetIds: readonly string[],
  platform: NodeJS.Platform
): Map<string, string[]> {
  const parsed = parseKeybinding(binding)!
  return new Map(
    targetIds
      .slice(0, MAX_DIGIT_INDEX)
      .map((id, index) => [
        id,
        formatKeybinding(
          canonicalizeParsedKeybinding({ ...parsed, key: String(index + 1) }),
          platform
        )
      ])
  )
}

export function createWorkspaceIndexShortcutHintStore(sources: HintSources) {
  let shown: Map<string, string[]> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let usedForOtherKey = false
  const listeners = new Set<() => void>()

  function show(next: Map<string, string[]> | null): void {
    if (shown === next) {
      return
    }
    shown = next
    for (const listener of listeners) {
      listener()
    }
  }

  function cancelPending(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function clear(): void {
    cancelPending()
    usedForOtherKey = false
    show(null)
  }

  function keyDown(event: HeldModifiers & Pick<KeyboardEvent, 'key'>): void {
    cancelPending()
    if (!MODIFIER_KEYS.has(event.key)) {
      usedForOtherKey = true
      show(null)
      return
    }
    show(null)
    if (usedForOtherKey || !sources.isEnabled()) {
      return
    }
    const platform = sources.getPlatform()
    const binding = bindingForHeldModifiers(sources.getBindings(), event, platform)
    if (!binding) {
      return
    }
    timer = setTimeout(() => {
      timer = null
      show(keysByTarget(binding, sources.getTargetIds(), platform))
    }, WORKSPACE_INDEX_SHORTCUT_HINT_DELAY_MS)
  }

  function keyUp(event: HeldModifiers): void {
    if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
      clear()
      return
    }
    cancelPending()
    show(null)
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getKeys(worktreeId: string): string[] | null {
    return shown?.get(worktreeId) ?? null
  }

  return { keyDown, keyUp, clear, subscribe, getKeys, listenerCount: () => listeners.size }
}

const hintStore = createWorkspaceIndexShortcutHintStore({
  getBindings: () =>
    getEffectiveKeybindingsForAction(
      'workspace.selectByIndex',
      getShortcutPlatform(),
      useAppStore.getState().keybindings
    ),
  getPlatform: getShortcutPlatform,
  getTargetIds: () => getVisibleWorktreeShortcutTargets().map((target) => target.id),
  // Why: the digit jump only acts from the workspace view, so hints elsewhere would mislead.
  isEnabled: () => useAppStore.getState().activeView === 'terminal'
})

function installListeners(): void {
  addAppKeyListener('keydown', hintStore.keyDown)
  addAppKeyListener('keyup', hintStore.keyUp)
  window.addEventListener('blur', hintStore.clear)
  document.addEventListener('visibilitychange', hintStore.clear)
}

function uninstallListeners(): void {
  removeAppKeyListener('keydown', hintStore.keyDown)
  removeAppKeyListener('keyup', hintStore.keyUp)
  window.removeEventListener('blur', hintStore.clear)
  document.removeEventListener('visibilitychange', hintStore.clear)
  hintStore.clear()
}

function subscribeHint(listener: () => void): () => void {
  const unsubscribe = hintStore.subscribe(listener)
  if (hintStore.listenerCount() === 1) {
    installListeners()
  }
  return () => {
    unsubscribe()
    if (hintStore.listenerCount() === 0) {
      uninstallListeners()
    }
  }
}

/** Feeds a key a focused page kept, which the window's listeners never see. */
export function observeWorkspaceIndexShortcutKey(
  key: HeldModifiers & Pick<KeyboardEvent, 'key' | 'type'>
): void {
  if (key.type === 'keydown') {
    hintStore.keyDown(key)
  } else {
    hintStore.keyUp(key)
  }
}

export function useWorkspaceIndexShortcutKeys(worktreeId: string): string[] | null {
  return useSyncExternalStore(
    subscribeHint,
    () => hintStore.getKeys(worktreeId),
    () => null
  )
}
