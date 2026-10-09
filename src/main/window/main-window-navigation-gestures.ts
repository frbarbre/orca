import type { BrowserWindow } from 'electron'

type HistoryDirection = 'back' | 'forward'

export function historyDirectionForSwipe(direction: string): HistoryDirection | null {
  return direction === 'left' ? 'back' : direction === 'right' ? 'forward' : null
}

export function historyDirectionForAppCommand(command: string): HistoryDirection | null {
  return command === 'browser-backward' ? 'back' : command === 'browser-forward' ? 'forward' : null
}

// Fork: mouse back/forward buttons. Logi Options+ on macOS sends them as a navigation swipe and
// Windows/Linux as an app command, so neither reaches the page as a mouse event.
export function installMainWindowNavigationGestures(mainWindow: BrowserWindow): void {
  const navigate = (direction: HistoryDirection | null): void => {
    if (direction && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ui:worktreeHistoryNavigate', direction)
    }
  }
  mainWindow.on('swipe', (_event, direction) => navigate(historyDirectionForSwipe(direction)))
  mainWindow.on('app-command', (_event, command) =>
    navigate(historyDirectionForAppCommand(command))
  )
}
