import { dirname, isAbsolute, join, relative } from 'node:path'

export type TypeScriptProject = { projectRoot: string; binDirs: string[] }

const PROJECT_MARKERS = ['tsconfig.json', 'jsconfig.json']

export function directoriesUpTo(startDir: string, worktreeRoot: string): string[] {
  const dirs: string[] = []
  for (let dir = startDir; ; dir = dirname(dir)) {
    const rel = relative(worktreeRoot, dir)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return dirs
    }
    dirs.push(dir)
    if (rel === '') {
      return dirs
    }
  }
}

export function resolveTypeScriptProject({
  filePath,
  worktreeRoot,
  repoRoot,
  exists
}: {
  filePath: string
  worktreeRoot: string
  /** The repo's main checkout, whose node_modules a fresh worktree can borrow. */
  repoRoot?: string | null
  exists: (path: string) => boolean
}): TypeScriptProject {
  const projectRoot =
    directoriesUpTo(dirname(filePath), worktreeRoot).find((dir) =>
      PROJECT_MARKERS.some((marker) => exists(join(dir, marker)))
    ) ?? worktreeRoot
  const searchDirs = directoriesUpTo(projectRoot, worktreeRoot)
  if (repoRoot && repoRoot !== worktreeRoot) {
    searchDirs.push(
      ...directoriesUpTo(join(repoRoot, relative(worktreeRoot, projectRoot)), repoRoot)
    )
  }
  // Why the project's own server first: it matches the TypeScript version the repo builds with.
  return { projectRoot, binDirs: searchDirs.map((dir) => join(dir, 'node_modules', '.bin')) }
}
