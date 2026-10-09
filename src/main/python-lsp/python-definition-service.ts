import { isAbsolute } from 'node:path'
import type {
  PythonDefinitionRequest,
  PythonDefinitionResult
} from '../../shared/python-definition'
import { resolvePythonProject, type PythonProject } from './python-project-resolution'
import type { PyreflySession } from './pyrefly-lsp-session'
import { createPyreflySessionPool } from './pyrefly-lsp-pool'

const IDLE_MS = 15 * 60_000
const MAX_SESSIONS = 4
const PYTHON_FILE = /\.pyi?$/i

type Session = Pick<PyreflySession, 'closed' | 'definition' | 'dispose'>

export function createPythonDefinitionService({
  exists,
  startSession
}: {
  exists: (path: string) => boolean
  startSession: (project: PythonProject) => Session
}): {
  definition: (request: PythonDefinitionRequest) => Promise<PythonDefinitionResult>
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

  return {
    definition: async ({ filePath, worktreeRoot, venvSetting, text, line, character }) => {
      if (!isAbsolute(filePath) || !isAbsolute(worktreeRoot) || !PYTHON_FILE.test(filePath)) {
        return { ok: false, error: 'Not a Python file in a local worktree.' }
      }
      const project = resolvePythonProject({ filePath, worktreeRoot, venvSetting, exists })
      const key = JSON.stringify([project.pyrefly, project.projectRoot, project.venvPath])
      projects.set(key, project)
      try {
        const locations = await pool.acquire(key).definition({ filePath, text, line, character })
        return { ok: true, locations }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
    disposeAll: () => pool.disposeAll()
  }
}
