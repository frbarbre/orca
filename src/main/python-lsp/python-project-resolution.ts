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

function isVenv(venv: string, exists: (p: string) => boolean): boolean {
  return exists(join(venv, 'bin', 'pyrefly')) || exists(join(venv, 'bin', 'python'))
}

function findVenv(roots: readonly string[], exists: (p: string) => boolean) {
  for (const root of new Set(roots)) {
    for (const name of VENV_DIRS) {
      const venv = join(root, name)
      if (isVenv(venv, exists)) {
        return venv
      }
    }
  }
  return null
}

export function resolvePythonProject({
  filePath,
  worktreeRoot,
  repoRoot,
  venvSetting,
  exists
}: {
  filePath: string
  worktreeRoot: string
  /** The repo's main checkout, whose venv a fresh worktree can borrow. */
  repoRoot?: string | null
  venvSetting: string | null
  exists: (path: string) => boolean
}): PythonProject {
  const projectRoot = findProjectRoot(filePath, worktreeRoot, exists)
  // Why the main checkout too: new worktrees rarely get their own venv, and the packages match.
  const mainCheckout = repoRoot && repoRoot !== worktreeRoot ? repoRoot : null
  const configured = venvSetting?.trim()
  let venvPath: string | null
  if (configured) {
    const inWorktree = resolve(worktreeRoot, configured)
    const inMainCheckout = mainCheckout ? resolve(mainCheckout, configured) : null
    venvPath =
      !isVenv(inWorktree, exists) && inMainCheckout && isVenv(inMainCheckout, exists)
        ? inMainCheckout
        : inWorktree
  } else {
    const roots = [projectRoot, worktreeRoot]
    if (mainCheckout) {
      roots.push(join(mainCheckout, relative(worktreeRoot, projectRoot)), mainCheckout)
    }
    venvPath = findVenv(roots, exists)
  }
  const venvPyrefly = venvPath ? join(venvPath, 'bin', 'pyrefly') : null
  return {
    projectRoot,
    venvPath,
    pyrefly: venvPyrefly && exists(venvPyrefly) ? venvPyrefly : 'pyrefly'
  }
}
