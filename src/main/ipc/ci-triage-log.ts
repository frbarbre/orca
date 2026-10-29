import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { createCiTriageLog } from '../ci-triage-log'

// Fork: the renderer decides CI triage; this keeps its decisions in `<userData>/logs/ci-triage.jsonl`.
export function registerCiTriageLogHandlers(): void {
  const log = createCiTriageLog({
    filePath: join(app.getPath('userData'), 'logs', 'ci-triage.jsonl'),
    version: app.getVersion()
  })
  ipcMain.handle('ciTriage:log', async (_event, entry: unknown) => {
    if (typeof entry === 'object' && entry !== null) {
      await log.record(entry as Parameters<typeof log.record>[0]).catch(() => {})
    }
  })
}
