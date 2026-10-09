import { isAbsolute } from 'node:path'
import type {
  LanguageServerDefinitionResult,
  LanguageServerHoverResult,
  LanguageServerLanguage,
  LanguageServerRequest
} from '../../shared/language-server'
import { resolvePythonProject } from './python-project-resolution'
import { resolveTypeScriptProject } from './typescript-project-resolution'
import type { LspSession } from './lsp-session'
import { createLspSessionPool } from './lsp-session-pool'

const IDLE_MS = 15 * 60_000
const MAX_SESSIONS = 4
const FILE_PATTERNS: Record<LanguageServerLanguage, RegExp> = {
  python: /\.pyi?$/i,
  typescript: /\.[mc]?[jt]sx?$/i
}

export type LanguageServerLaunch = {
  language: LanguageServerLanguage
  serverName: string
  projectRoot: string
  program: string
  args: string[]
  venvPath: string | null
}

type Session = Pick<LspSession, 'closed' | 'definition' | 'hover' | 'dispose'>

function resolveLaunch(
  { language, filePath, worktreeRoot, repoRoot, venvSetting }: LanguageServerRequest,
  exists: (path: string) => boolean
): LanguageServerLaunch {
  if (language === 'typescript') {
    const project = resolveTypeScriptProject({ filePath, worktreeRoot, repoRoot, exists })
    return {
      language,
      serverName: 'tsgo',
      projectRoot: project.projectRoot,
      program: project.tsgo,
      args: ['--lsp', '--stdio'],
      venvPath: null
    }
  }
  const project = resolvePythonProject({ filePath, worktreeRoot, repoRoot, venvSetting, exists })
  return {
    language,
    serverName: 'pyrefly',
    projectRoot: project.projectRoot,
    program: project.pyrefly,
    args: ['lsp'],
    venvPath: project.venvPath
  }
}

function sessionKey(launch: LanguageServerLaunch): string {
  return `${launch.language}\0${JSON.stringify([launch.program, launch.projectRoot, launch.venvPath])}`
}

export function createLanguageServerService({
  exists,
  readPreview,
  startSession
}: {
  exists: (path: string) => boolean
  readPreview: (filePath: string, line: number) => string | null
  startSession: (launch: LanguageServerLaunch) => Session
}): {
  definition: (request: LanguageServerRequest) => Promise<LanguageServerDefinitionResult>
  hover: (request: LanguageServerRequest) => Promise<LanguageServerHoverResult>
  stopLanguage: (language: LanguageServerLanguage) => void
  disposeAll: () => void
} {
  const launches = new Map<string, LanguageServerLaunch>()
  const pool = createLspSessionPool<Session>({
    start: (key) => {
      const launch = launches.get(key)
      if (!launch) {
        throw new Error('Unknown language server project')
      }
      return startSession(launch)
    },
    idleMs: IDLE_MS,
    maxSessions: MAX_SESSIONS
  })

  const withSession = async <T>(
    request: LanguageServerRequest,
    ask: (session: Session) => Promise<T>
  ): Promise<{ ok: true; value: T } | { ok: false; error: string }> => {
    const { language, filePath, worktreeRoot } = request
    const pattern = FILE_PATTERNS[language]
    if (!pattern || !isAbsolute(filePath) || !isAbsolute(worktreeRoot) || !pattern.test(filePath)) {
      return { ok: false, error: `Not a ${language} file in a local worktree.` }
    }
    const launch = resolveLaunch(request, exists)
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
    stopLanguage: (language) => pool.disposeMatching((key) => key.startsWith(`${language}\0`)),
    disposeAll: () => pool.disposeAll()
  }
}
