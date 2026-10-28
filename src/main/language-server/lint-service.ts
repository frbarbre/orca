import { isAbsolute, relative } from 'node:path'
import type {
  LintDiagnostic,
  LintDiagnosticsEvent,
  LintRequest,
  LintSyncResult,
  LinterId
} from '../../shared/linter'
import { resolveLinterLaunch, type LinterLaunch } from './linter-launch'
import type { LspSession } from './lsp-session'
import { createLspSessionPool } from './lsp-session-pool'

const IDLE_MS = 15 * 60_000
const MAX_SESSIONS = 4

type LintSession = Pick<LspSession, 'closed' | 'open' | 'close' | 'dispose'>

function within(root: string, path: string): boolean {
  const rel = relative(root, path)
  return !rel.startsWith('..') && !isAbsolute(rel)
}

// Fork: one linter server per project, fed the open files' text, its findings pushed back as
// they come.
export function createLintService({
  exists,
  startSession,
  onDiagnostics,
  admit
}: {
  exists: (path: string) => boolean
  startSession: (
    launch: LinterLaunch,
    publish: (filePath: string, diagnostics: LintDiagnostic[]) => void
  ) => LintSession
  onDiagnostics: (event: LintDiagnosticsEvent) => void
  /** Admits a server into its project, throwing while the project is being removed. */
  admit?: (projectRoot: string) => () => void
}): {
  sync: (request: LintRequest) => Promise<LintSyncResult>
  close: (args: { linter: LinterId; filePath: string }) => void
  stopLinter: (linter: LinterId) => void
  stopUnder: (root: string) => void
  disposeAll: () => void
} {
  const launches = new Map<string, LinterLaunch>()
  const openFiles = new Map<string, LintSession>()
  const pool = createLspSessionPool<LintSession>({
    start: (key) => {
      const launch = launches.get(key)
      if (!launch) {
        throw new Error('Unknown linter project')
      }
      const release = admit?.(launch.projectRoot)
      try {
        const session = startSession(launch, (filePath, diagnostics) =>
          onDiagnostics({ linter: launch.linter, filePath, diagnostics })
        )
        return release
          ? {
              get closed() {
                return session.closed
              },
              open: (filePath, text) => session.open(filePath, text),
              close: (filePath) => session.close(filePath),
              dispose: () => {
                session.dispose()
                release()
              }
            }
          : session
      } catch (error) {
        release?.()
        throw error
      }
    },
    idleMs: IDLE_MS,
    maxSessions: MAX_SESSIONS
  })

  return {
    sync: async (request) => {
      if (!isAbsolute(request.filePath) || !isAbsolute(request.worktreeRoot)) {
        return { ok: true }
      }
      const launch = resolveLinterLaunch(request, exists)
      if (!launch) {
        return { ok: true }
      }
      const key = `${launch.linter}\0${JSON.stringify([launch.program, launch.projectRoot])}`
      launches.set(key, launch)
      try {
        const session = pool.acquire(key)
        openFiles.set(`${request.linter}\0${request.filePath}`, session)
        await session.open(request.filePath, request.text)
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
    close: ({ linter, filePath }) => {
      const fileKey = `${linter}\0${filePath}`
      openFiles.get(fileKey)?.close(filePath)
      openFiles.delete(fileKey)
    },
    stopLinter: (linter) => pool.disposeMatching((key) => key.startsWith(`${linter}\0`)),
    stopUnder: (root) =>
      pool.disposeMatching((key) => {
        const projectRoot = launches.get(key)?.projectRoot
        return projectRoot !== undefined && within(root, projectRoot)
      }),
    disposeAll: () => pool.disposeAll()
  }
}
