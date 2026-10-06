import { BrowserWindow, Menu, webContents } from 'electron'

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
      // Why: a focused terminal/native-chat pane is not a native editable
      // control, so raw Electron paste cannot know which Orca surface owns it.
      const focusedWindow = BrowserWindow.getFocusedWindow()
      if (focusedWindow) {
        // Why: a focused <webview> page owns its own editing; the renderer's paste routing only
        // sees the host element, so its fallback paste never reaches the page.
        const focusedContents = webContents.getFocusedWebContents()
        if (
          focusedContents &&
          focusedContents !== focusedWindow.webContents &&
          focusedContents.getType() === 'webview' &&
          focusedContents.hostWebContents === focusedWindow.webContents
        ) {
          focusedContents.paste()
          return
        }
        focusedWindow.webContents.send('ui:appMenuPaste')
        return
      }

      // Why: a macOS native panel (open/save, Go to Folder) leaves no focused
      // BrowserWindow, so overriding the paste role would strand Cmd+V as a no-op.
      if (isMac) {
        Menu.sendActionToFirstResponder('paste:')
      }
    }
  }
}
