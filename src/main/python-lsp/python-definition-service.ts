import { isAbsolute } from 'node:path'
import type {
  PythonDefinitionRequest,
  PythonDefinitionResult,
  PythonHoverResult
} from '../../shared/python-definition'
import { resolvePythonProject, type PythonProject } from './python-project-resolution'
import type { PyreflySession } from './pyrefly-lsp-session'
import { createPyreflySessionPool } from './pyrefly-lsp-pool'

const IDLE_MS = 15 * 60_000
const MAX_SESSIONS = 4
const PYTHON_FILE = /\.pyi?$/i

type Session = Pick<PyreflySession, 'closed' | 'definition' | 'hover' | 'dispose'>

export function createPythonDefinitionService({
  exists,
  startSession
}: {
  exists: (path: string) => boolean
  startSession: (project: PythonProject) => Session
}): {
  definition: (request: PythonDefinitionRequest) => Promise<PythonDefinitionResult>
  hover: (request: PythonDefinitionRequest) => Promise<PythonHoverResult>
  disposeAll: () => void
} {
  const projects = new Map<string, PythonProject>()
  const pool = createPyreflySessionPool<Session>({
    start: (key) => {
      const project = projects.get(key)
      if (!project) {
        throw new Error('Unknown Python project')
      }
      return startSession(project)
    },
    idleMs: IDLE_MS,
    maxSessions: MAX_SESSIONS
  })

  const withSession = async <T>(
    { filePath, worktreeRoot, repoRoot, venvSetting }: PythonDefinitionRequest,
    ask: (session: Session) => Promise<T>
  ): Promise<{ ok: true; value: T } | { ok: false; error: string }> => {
    if (!isAbsolute(filePath) || !isAbsolute(worktreeRoot) || !PYTHON_FILE.test(filePath)) {
      return { ok: false, error: 'Not a Python file in a local worktree.' }
    }
    const project = resolvePythonProject({ filePath, worktreeRoot, repoRoot, venvSetting, exists })
    const key = JSON.stringify([project.pyrefly, project.projectRoot, project.venvPath])
    projects.set(key, project)
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
      return result.ok ? { ok: true, locations: result.value } : result
    },
    hover: async (request) => {
      const { filePath, text, line, character } = request
      const result = await withSession(request, (session) =>
        session.hover({ filePath, text, line, character })
      )
      return result.ok ? { ok: true, markdown: result.value } : result
    },
    disposeAll: () => pool.disposeAll()
  }
}
