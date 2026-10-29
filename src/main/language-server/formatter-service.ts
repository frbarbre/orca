import { isAbsolute, relative } from 'node:path'
import type { FormatRequest, FormatResult, FormatterId } from '../../shared/formatter'
import {
  resolveFormatterLaunch,
  type FormatterFiles,
  type FormatterLaunch
} from './formatter-launch'
import type { LspSession } from './lsp-session'
import { createLspSessionPool } from './lsp-session-pool'

const IDLE_MS = 15 * 60_000
const MAX_SESSIONS = 4

type FormatterSession = Pick<LspSession, 'closed' | 'format' | 'close' | 'dispose'>

function within(root: string, path: string): boolean {
  const rel = relative(root, path)
  return !rel.startsWith('..') && !isAbsolute(rel)
}

// Fork: one formatter server per project, asked for the edits that format the editor's text.
export function createFormatterService({
  files,
  startSession,
  admit
}: {
  files: FormatterFiles
  startSession: (launch: FormatterLaunch) => FormatterSession
  /** Admits a server into its project, throwing while the project is being removed. */
  admit?: (projectRoot: string) => () => void
}): {
  format: (request: FormatRequest) => Promise<FormatResult>
  stopFormatter: (formatter: FormatterId) => void
  stopUnder: (root: string) => void
  disposeAll: () => void
} {
  const launches = new Map<string, FormatterLaunch>()
  const pool = createLspSessionPool<FormatterSession>({
    start: (key) => {
      const launch = launches.get(key)
      if (!launch) {
        throw new Error('Unknown formatter project')
      }
      const release = admit?.(launch.projectRoot)
      try {
        const session = startSession(launch)
        if (!release) {
          return session
        }
        return {
          get closed() {
            return session.closed
          },
          format: (request) => session.format(request),
          close: (filePath) => session.close(filePath),
          dispose: () => {
            session.dispose()
            release()
          }
        }
      } catch (error) {
        release?.()
        throw error
      }
    },
    idleMs: IDLE_MS,
    maxSessions: MAX_SESSIONS
  })

  return {
    format: async (request) => {
      if (!isAbsolute(request.filePath) || !isAbsolute(request.worktreeRoot)) {
        return { ok: true, edits: [] }
      }
      const launch = resolveFormatterLaunch(request, files)
      if (!launch) {
        return { ok: true, edits: [] }
      }
      const key = `${launch.formatter}\0${JSON.stringify([launch.program, launch.projectRoot])}`
      launches.set(key, launch)
      try {
        const session = pool.acquire(key)
        const { filePath, text, tabSize, insertSpaces } = request
        try {
          return {
            ok: true,
            edits: await session.format({ filePath, text, tabSize, insertSpaces })
          }
        } finally {
          session.close(filePath)
        }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
    stopFormatter: (formatter) => pool.disposeMatching((key) => key.startsWith(`${formatter}\0`)),
    stopUnder: (root) =>
      pool.disposeMatching((key) => {
        const projectRoot = launches.get(key)?.projectRoot
        return projectRoot !== undefined && within(root, projectRoot)
      }),
    disposeAll: () => pool.disposeAll()
  }
}
