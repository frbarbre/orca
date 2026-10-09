import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

export type PythonProject = { projectRoot: string; venvPath: string | null; pyrefly: string }

const PROJECT_MARKERS = ['pyrefly.toml', 'pyproject.toml']
const VENV_DIRS = ['.venv', 'venv']

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function findProjectRoot(filePath: string, worktreeRoot: string, exists: (p: string) => boolean) {
  for (let dir = dirname(filePath); isInside(worktreeRoot, dir); dir = dirname(dir)) {
    if (PROJECT_MARKERS.some((marker) => exists(join(dir, marker)))) {
      return dir
    }
    if (dir === worktreeRoot) {
      break
    }
  }
  return worktreeRoot
}

function findVenv(projectRoot: string, worktreeRoot: string, exists: (p: string) => boolean) {
  for (const root of new Set([projectRoot, worktreeRoot])) {
    for (const name of VENV_DIRS) {
      const venv = join(root, name)
      if (exists(join(venv, 'bin', 'pyrefly')) || exists(join(venv, 'bin', 'python'))) {
        return venv
      }
    }
  }
  return null
}

export function resolvePythonProject({
  filePath,
  worktreeRoot,
  venvSetting,
  exists
}: {
  filePath: string
  worktreeRoot: string
  venvSetting: string | null
  exists: (path: string) => boolean
}): PythonProject {
  const projectRoot = findProjectRoot(filePath, worktreeRoot, exists)
  const configured = venvSetting?.trim()
  const venvPath = configured
    ? resolve(worktreeRoot, configured)
    : findVenv(projectRoot, worktreeRoot, exists)
  const venvPyrefly = venvPath ? join(venvPath, 'bin', 'pyrefly') : null
  return {
    projectRoot,
    venvPath,
    pyrefly: venvPyrefly && exists(venvPyrefly) ? venvPyrefly : 'pyrefly'
  }
}
