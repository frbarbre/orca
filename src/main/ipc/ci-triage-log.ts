import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { createCiTriageLog } from '../ci-triage-log'

// Fork: the renderer decides CI triage; this keeps its decisions in `<userData>/logs/ci-triage.jsonl`.
export function registerCiTriageLogHandlers(): void {
  let log: ReturnType<typeof createCiTriageLog> | null = null
  ipcMain.handle('ciTriage:log', async (_event, entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) {
      return
    }
    // Why on first use: registration runs before anything needs the file, in tests too.
    log ??= createCiTriageLog({
      filePath: join(app.getPath('userData'), 'logs', 'ci-triage.jsonl'),
      version: app.getVersion()
    })
    await log.record(entry as Parameters<typeof log.record>[0]).catch(() => {})
  })
}
