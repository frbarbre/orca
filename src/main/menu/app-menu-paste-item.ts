import { BrowserWindow, Menu } from 'electron'
import { resolveNativeEditTarget } from './app-menu-selection-item'

export function createAppMenuPasteItem({
  label,
  isMac
}: {
  label: string
  isMac: boolean
}): Electron.MenuItemConstructorOptions {
  return {
    label,
    accelerator: 'CmdOrCtrl+V',
    click: () => {
      // Electron paste cannot resolve ownership among Orca terminal/chat surfaces.
      const focusedWindow = BrowserWindow.getFocusedWindow()
      if (focusedWindow) {
        // Focused DevTools must own paste over the renderer's last-focused terminal (#16285).
        const nativeTarget = resolveNativeEditTarget(focusedWindow)
        if (nativeTarget) {
          return nativeTarget.paste()
        }
        focusedWindow.webContents.send('ui:appMenuPaste')
        return
      }

      // Native macOS panels leave no focused BrowserWindow; preserve first-responder Cmd+V.
      if (isMac) {
        Menu.sendActionToFirstResponder('paste:')
      }
    }
  }
}
