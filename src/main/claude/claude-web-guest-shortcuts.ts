import { keybindingMatchesAction, type KeybindingOverrides } from '../../shared/keybindings'

type ClaudeWebGuest = Pick<
  Electron.WebContents,
  'on' | 'reload' | 'reloadIgnoringCache' | 'isDestroyed'
>

const installedGuests = new WeakSet<object>()

// Why: a focused <webview> guest is its own process, so the renderer never sees its keys; the
// claude.ai page is not a registered browser tab, so the browser's guest forwarding skips it too.
export function installClaudeWebGuestShortcuts(
  guest: ClaudeWebGuest,
  getKeybindings: () => KeybindingOverrides | undefined,
  platform: NodeJS.Platform = process.platform
): void {
  if (installedGuests.has(guest)) {
    return
  }
  installedGuests.add(guest)
  guest.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || guest.isDestroyed()) {
      return
    }
    const keybindings = getKeybindings()
    if (keybindingMatchesAction('browser.hardReload', input, platform, keybindings)) {
      event.preventDefault()
      guest.reloadIgnoringCache()
    } else if (keybindingMatchesAction('browser.reload', input, platform, keybindings)) {
      event.preventDefault()
      guest.reload()
    }
  })
}
