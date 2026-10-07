import {
  KEYBINDING_DEFINITIONS,
  keybindingMatchesAction,
  type KeybindingOverrides,
  type KeybindingScope
} from '../../shared/keybindings'
import type { ClaudeWebReplayedKey } from '../../shared/claude-remote-session'
import {
  resolveWindowShortcutAction,
  type WindowShortcutAction
} from '../../shared/window-shortcut-policy'

type ClaudeWebGuest = {
  on(
    event: 'before-input-event',
    listener: (event: { preventDefault(): void }, input: Electron.Input) => void
  ): unknown
  reload(): void
  reloadIgnoringCache(): void
  isDestroyed(): boolean
}

// Why only these: terminal/editor/browser-page chords would act on surfaces the page covers,
// and the page's own editing keys (copy, paste, undo) belong to none of these scopes.
const APP_SCOPES: ReadonlySet<KeybindingScope> = new Set(['global', 'tabs'])
const APP_ACTION_IDS = KEYBINDING_DEFINITIONS.filter((definition) =>
  APP_SCOPES.has(definition.scope)
).map((definition) => definition.id)
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift'])

const installedGuests = new WeakSet<object>()

function toReplayedKey(
  input: Electron.Input,
  type: ClaudeWebReplayedKey['type']
): ClaudeWebReplayedKey {
  return {
    type,
    key: input.key,
    code: input.code,
    metaKey: input.meta,
    ctrlKey: input.control,
    altKey: input.alt,
    shiftKey: input.shift
  }
}

// Why: a focused <webview> guest is its own process, so the renderer never sees its keys; the
// claude.ai page is not a registered browser tab, so the browser's guest forwarding skips it too.
export function installClaudeWebGuestShortcuts(
  guest: ClaudeWebGuest,
  getKeybindings: () => KeybindingOverrides | undefined,
  replayInRenderer: (key: ClaudeWebReplayedKey) => void,
  runWindowAction: (action: WindowShortcutAction) => void,
  platform: NodeJS.Platform = process.platform
): void {
  if (installedGuests.has(guest)) {
    return
  }
  installedGuests.add(guest)
  // Why: hold-to-switch chords (Ctrl+Tab) commit on the modifier's release, which the page
  // receives; once a chord went to Orca, its modifier releases must follow it there.
  let forwardingModifierReleases = false
  guest.on('before-input-event', (event, input) => {
    if (guest.isDestroyed()) {
      return
    }
    if (input.type === 'keyUp') {
      if (forwardingModifierReleases && MODIFIER_KEYS.has(input.key)) {
        replayInRenderer(toReplayedKey(input, 'keyup'))
        forwardingModifierReleases = input.meta || input.control || input.alt || input.shift
      }
      return
    }
    if (input.type !== 'keyDown') {
      return
    }
    const keybindings = getKeybindings()
    if (keybindingMatchesAction('browser.hardReload', input, platform, keybindings)) {
      event.preventDefault()
      guest.reloadIgnoringCache()
      return
    }
    if (keybindingMatchesAction('browser.reload', input, platform, keybindings)) {
      event.preventDefault()
      guest.reload()
      return
    }
    // Why: the main window runs these in main (number jumps never reach the renderer's DOM), so a replayed key would do nothing.
    const windowAction = resolveWindowShortcutAction(input, platform, keybindings)
    if (windowAction && windowAction.type !== 'dictationKeyDown') {
      event.preventDefault()
      if (!input.isAutoRepeat) {
        runWindowAction(windowAction)
      }
      return
    }
    if (APP_ACTION_IDS.some((id) => keybindingMatchesAction(id, input, platform, keybindings))) {
      event.preventDefault()
      forwardingModifierReleases = true
      replayInRenderer(toReplayedKey(input, 'keydown'))
    }
  })
}
