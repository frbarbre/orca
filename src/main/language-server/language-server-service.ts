import { isAbsolute, relative } from 'node:path'
import {
  languageServerForFile,
  type LanguageServerDefinitionResult,
  type LanguageServerHoverResult,
  type LanguageServerLanguage,
  type LanguageServerReferencesResult,
  type LanguageServerRequest
} from '../../shared/language-server'
import { resolveLaunch, type LanguageServerLaunch } from './language-server-launchers'
import type { LspSession, WatchedFileChange } from './lsp-session'
import { createLspSessionPool } from './lsp-session-pool'

const IDLE_MS = 15 * 60_000
const MAX_SESSIONS = 4
const MAX_REFERENCE_FILES = 50

type Session = Pick<
  LspSession,
  'closed' | 'definition' | 'hover' | 'references' | 'filesChanged' | 'dispose'
>

/** Watches a project for disk changes; returns the call that stops watching. */
export type WatchProjectFiles = (
  root: string,
  onChanges: (changes: WatchedFileChange[]) => void
) => () => void

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function sessionKey(launch: LanguageServerLaunch): string {
  return `${launch.language}\0${JSON.stringify([launch.program, launch.projectRoot, launch.env, launch.pathPrefix])}`
}

export function createLanguageServerService({
  exists,
  readPreview,
  readFile,
  startSession,
  watchFiles
}: {
  exists: (path: string) => boolean
  readPreview: (filePath: string, line: number) => string | null
  readFile: (filePath: string) => string | null
  startSession: (launch: LanguageServerLaunch) => Session
  watchFiles?: WatchProjectFiles
}): {
  definition: (request: LanguageServerRequest) => Promise<LanguageServerDefinitionResult>
  hover: (request: LanguageServerRequest) => Promise<LanguageServerHoverResult>
  references: (request: LanguageServerRequest) => Promise<LanguageServerReferencesResult>
  stopLanguage: (language: LanguageServerLanguage) => void
  disposeAll: () => void
} {
  const launches = new Map<string, LanguageServerLaunch>()
  const lastLaunchByWorktree = new Map<string, LanguageServerLaunch>()
  const pool = createLspSessionPool<Session>({
    start: (key) => {
      const launch = launches.get(key)
      if (!launch) {
        throw new Error('Unknown language server project')
      }
      const session = startSession(launch)
      const stopWatching = watchFiles?.(launch.projectRoot, (changes) =>
        session.filesChanged(changes)
      )
      if (!stopWatching) {
        return session
      }
      // Why wrap dispose: the pool ends a session through it (idle, eviction, stop), and the
      // watcher must go with the server it feeds.
      return {
        get closed() {
          return session.closed
        },
        definition: (request) => session.definition(request),
        hover: (request) => session.hover(request),
        references: (request) => session.references(request),
        filesChanged: (changes) => session.filesChanged(changes),
        dispose: () => {
          stopWatching()
          session.dispose()
        }
      }
    },
    idleMs: IDLE_MS,
    maxSessions: MAX_SESSIONS
  })

  const withSession = async <T>(
    request: LanguageServerRequest,
    ask: (session: Session) => Promise<T>
  ): Promise<{ ok: true; value: T } | { ok: false; error: string }> => {
    const { language, filePath, worktreeRoot } = request
    if (
      languageServerForFile(filePath)?.language !== language ||
      !isAbsolute(filePath) ||
      !isAbsolute(worktreeRoot)
    ) {
      return { ok: false, error: `Not a ${language} file in a local worktree.` }
    }
    // Why: a file outside the checkout (a bundled typeshed stub, a global package) has no project
    // of its own, so it goes to the server that led there, with that project's venv.
    const outside =
      !isInside(worktreeRoot, filePath) &&
      !(request.repoRoot && isInside(request.repoRoot, filePath))
    const lastKey = `${language}\0${worktreeRoot}`
    const launch = (outside && lastLaunchByWorktree.get(lastKey)) || resolveLaunch(request, exists)
    if (!outside) {
      lastLaunchByWorktree.set(lastKey, launch)
    }
    const key = sessionKey(launch)
    launches.set(key, launch)
    try {
      return { ok: true, value: await ask(pool.acquire(key)) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  return {
    definition: async (request) => {
      const { filePath, text, line, character } = request
      const result = await withSession(request, (session) =>
        session.definition({ filePath, text, line, character })
      )
      if (!result.ok) {
        return result
      }
      return {
        ok: true,
        locations: result.value.map((location) => {
          const preview = readPreview(location.filePath, location.line)
          return preview === null ? location : { ...location, preview }
        })
      }
    },
    hover: async (request) => {
      const { filePath, text, line, character } = request
      const result = await withSession(request, (session) =>
        session.hover({ filePath, text, line, character })
      )
      return result.ok ? { ok: true, markdown: result.value } : result
    },
    references: async (request) => {
      const { filePath, text, line, character } = request
      const result = await withSession(request, (session) =>
        session.references({ filePath, text, line, character })
      )
      if (!result.ok) {
        return result
      }
      // Why the texts: the peek view shows each reference in its file, and the renderer only
      // holds the files that are open.
      const files: Record<string, string> = {}
      const others = [...new Set(result.value.map((location) => location.filePath))].filter(
        (path) => path !== filePath
      )
      for (const path of others.slice(0, MAX_REFERENCE_FILES)) {
        const content = readFile(path)
        if (content !== null) {
          files[path] = content
        }
      }
      return { ok: true, locations: result.value, files }
    },
    stopLanguage: (language) => pool.disposeMatching((key) => key.startsWith(`${language}\0`)),
    disposeAll: () => pool.disposeAll()
  }
}
