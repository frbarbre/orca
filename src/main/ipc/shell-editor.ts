import { ipcMain } from 'electron'
import { readZshHistory } from '../shell-editor/zsh-history'
import { readGitDiffStat } from '../shell-editor/git-diff-stat'

export function registerShellEditorHandlers(): void {
  ipcMain.handle('shellEditor:readHistory', (_event, args: { path?: unknown }) =>
    typeof args?.path === 'string' ? readZshHistory(args.path) : []
  )
  ipcMain.handle('shellEditor:gitDiffStat', (_event, args: { cwd?: unknown }) =>
    typeof args?.cwd === 'string' ? readGitDiffStat(args.cwd) : null
  )
}
