import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { readZshHistory } from '../shell-editor/zsh-history'
import { readGitDiffStat } from '../shell-editor/git-diff-stat'
import { createZshCompletionWorker, type ZshCompletionWorker } from '../shell-editor/zsh-completion'

let completionWorker: ZshCompletionWorker | null = null

function getCompletionWorker(): ZshCompletionWorker {
  if (!completionWorker) {
    completionWorker = createZshCompletionWorker({
      scriptDir: join(app.getPath('userData'), 'shell-editor')
    })
    app.once('will-quit', () => completionWorker?.dispose())
  }
  return completionWorker
}

export function registerShellEditorHandlers(): void {
  ipcMain.handle('shellEditor:readHistory', (_event, args: { path?: unknown }) =>
    typeof args?.path === 'string' ? readZshHistory(args.path) : []
  )
  ipcMain.handle('shellEditor:gitDiffStat', (_event, args: { cwd?: unknown }) =>
    typeof args?.cwd === 'string' ? readGitDiffStat(args.cwd) : null
  )
  ipcMain.handle('shellEditor:complete', (_event, args: { cwd?: unknown; line?: unknown }) =>
    process.platform !== 'win32' && typeof args?.cwd === 'string' && typeof args.line === 'string'
      ? getCompletionWorker().complete({ cwd: args.cwd, line: args.line })
      : []
  )
  ipcMain.handle('shellEditor:warmCompletion', () => {
    if (process.platform !== 'win32') {
      getCompletionWorker().warm()
    }
  })
}
