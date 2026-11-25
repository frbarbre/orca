import { ipcMain } from 'electron'
import { readZshHistory } from '../shell-editor/zsh-history'

export function registerShellEditorHandlers(): void {
  ipcMain.handle('shellEditor:readHistory', (_event, args: { path?: unknown }) =>
    typeof args?.path === 'string' ? readZshHistory(args.path) : []
  )
}
