import { isAbsolute, relative } from 'node:path'
import {
  languageServerForFile,
  type LanguageServerCompletionRequest,
  type LanguageServerCompletionResult,
  type LanguageServerDefinitionResult,
  type LanguageServerDocument,
  type LanguageServerHoverResult,
  type LanguageServerLanguage,
  type LanguageServerReferencesResult,
  type LanguageServerRequest
} from '../../shared/language-server'
import type {
  DiagnosticsSyncResult,
  EditorDiagnostic,
  EditorDiagnosticsEvent
} from '../../shared/editor-diagnostics'
import { createHemolintFilter } from './hemolint-baseline'
import { resolveLaunch, type LanguageServerLaunch } from './language-server-launchers'
import type { LspSession, WatchedFileChange } from './lsp-session'
import { createLspSessionPool } from './lsp-session-pool'

const IDLE_MS = 15 * 60_000
const MAX_SESSIONS = 4
const MAX_REFERENCE_FILES = 50

type Session = Pick<
  LspSession,
  | 'closed'
  | 'definition'
  | 'hover'
  | 'references'
  | 'completion'
  | 'filesChanged'
  | 'dispose'
  | 'open'
  | 'close'
  | 'pullDiagnostics'
>

/** A file shown in an editor, whose errors the editor wants. */
type DiagnosedFile = {
  language: LanguageServerLanguage
  server: string
  worktreeRoot: string
  text: string
  key: string
  session: Session
}

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
  watchFiles,
  admit,
  onDiagnostics
}: {
  exists: (path: string) => boolean
  readPreview: (filePath: string, line: number) => string | null
  readFile: (filePath: string) => string | null
  startSession: (
    launch: LanguageServerLaunch,
    publish: (filePath: string, diagnostics: EditorDiagnostic[]) => void
  ) => Session
  onDiagnostics?: (event: EditorDiagnosticsEvent) => void
  watchFiles?: WatchProjectFiles
  /** Admits a server into its project, throwing while the project is being removed; the returned
   *  call releases it when the server stops. */
  admit?: (projectRoot: string) => () => void
}): {
  definition: (request: LanguageServerRequest) => Promise<LanguageServerDefinitionResult>
  hover: (request: LanguageServerRequest) => Promise<LanguageServerHoverResult>
  references: (request: LanguageServerRequest) => Promise<LanguageServerReferencesResult>
  completion: (request: LanguageServerCompletionRequest) => Promise<LanguageServerCompletionResult>
  /** Fork: hands the server an editor's text; its errors arrive through `onDiagnostics`. */
  sync: (document: LanguageServerDocument) => Promise<DiagnosticsSyncResult>
  closeDocument: (args: { language: LanguageServerLanguage; filePath: string }) => void
  stopLanguage: (language: LanguageServerLanguage) => void
  stopUnder: (root: string) => void
  disposeAll: () => void
} {
  const launches = new Map<string, LanguageServerLaunch>()
  const lastLaunchByWorktree = new Map<string, LanguageServerLaunch>()
  const diagnosed = new Map<string, DiagnosedFile>()
  const hideBaselined = createHemolintFilter({ exists, readFile })

  const report = (
    language: LanguageServerLanguage,
    filePath: string,
    diagnostics: EditorDiagnostic[]
  ): void => {
    const file = diagnosed.get(filePath)
    if (!file || file.language !== language) {
      return
    }
    const { server, worktreeRoot, text } = file
    // Why pyrefly only: hemolint keys a baseline by the tool that found it.
    const shown =
      server === 'pyrefly'
        ? hideBaselined({ tool: 'pyrefly', filePath, worktreeRoot, text, diagnostics })
        : diagnostics
    onDiagnostics?.({ source: language, filePath, diagnostics: shown })
  }

  const pull = async (filePath: string, file: DiagnosedFile): Promise<void> => {
    const diagnostics = await file.session.pullDiagnostics(filePath).catch(() => null)
    if (diagnostics) {
      report(file.language, filePath, diagnostics)
    }
  }

  // Why every open file: a change to one file can fix or break the files that import it.
  const recheck = async (key: string, except?: string): Promise<void> => {
    for (const [filePath, file] of diagnosed) {
      if (file.key === key && filePath !== except) {
        await pull(filePath, file)
      }
    }
  }

  const pool = createLspSessionPool<Session>({
    start: (key) => {
      const launch = launches.get(key)
      if (!launch) {
        throw new Error('Unknown language server project')
      }
      const release = admit?.(launch.projectRoot)
      let session: Session
      try {
        session = startSession(launch, (filePath, diagnostics) =>
          report(launch.language, filePath, diagnostics)
        )
      } catch (error) {
        release?.()
        throw error
      }
      const stopWatching = watchFiles?.(launch.projectRoot, (changes) => {
        session.filesChanged(changes)
        void recheck(key)
      })
      if (!stopWatching && !release) {
        return session
      }
      // Why wrap dispose: the pool ends a session through it (idle, eviction, stop), and the
      // watcher and removal fence must go with the server they belong to.
      return {
        get closed() {
          return session.closed
        },
        definition: (request) => session.definition(request),
        hover: (request) => session.hover(request),
        references: (request) => session.references(request),
        completion: (request) => session.completion(request),
        filesChanged: (changes) => session.filesChanged(changes),
        open: (filePath, text) => session.open(filePath, text),
        close: (filePath) => session.close(filePath),
        pullDiagnostics: (filePath) => session.pullDiagnostics(filePath),
        dispose: () => {
          stopWatching?.()
          session.dispose()
          release?.()
        }
      }
    },
    idleMs: IDLE_MS,
    maxSessions: MAX_SESSIONS
  })

  const withSession = async <T>(
    request: LanguageServerRequest,
    ask: (session: Session, key: string) => Promise<T>
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
      return { ok: true, value: await ask(pool.acquire(key), key) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  return {
    sync: async (document) => {
      const { language, server, filePath, worktreeRoot, text } = document
      const result = await withSession(
        { ...document, line: 0, character: 0 },
        async (session, key) => {
          const file = { language, server, worktreeRoot, text, key, session }
          diagnosed.set(filePath, file)
          await session.open(filePath, text)
          await pull(filePath, file)
          await recheck(key, filePath)
        }
      )
      return result.ok ? { ok: true } : result
    },
    closeDocument: ({ language, filePath }) => {
      const file = diagnosed.get(filePath)
      if (file?.language === language) {
        diagnosed.delete(filePath)
        file.session.close(filePath)
      }
    },
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
    completion: async (request) => {
      const { filePath, text, line, character, triggerCharacter } = request
      const result = await withSession(request, (session) =>
        session.completion({
          filePath,
          text,
          line,
          character,
          ...(triggerCharacter ? { triggerCharacter } : {})
        })
      )
      return result.ok ? { ok: true, ...result.value } : result
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
    stopUnder: (root) => {
      const within = (path: string): boolean => path === root || isInside(root, path)
      pool.disposeMatching((key) => {
        const projectRoot = launches.get(key)?.projectRoot
        return projectRoot !== undefined && within(projectRoot)
      })
      for (const [key, launch] of lastLaunchByWorktree) {
        if (within(launch.projectRoot)) {
          lastLaunchByWorktree.delete(key)
        }
      }
    },
    disposeAll: () => pool.disposeAll()
  }
}
