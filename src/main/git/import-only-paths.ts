import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isImportOnlyChange } from '../../shared/import-only-change'
import type { GitRuntimeOptions } from './git-runtime-options'
import { gitOptionsForWorktree } from './git-runtime-options'
import { gitExecFileAsync } from './runner'

const MAX_PATHS = 200
const MAX_FILE_CHARS = 256_000
const PARALLEL_READS = 8

/** The paths whose working-tree file differs from its base only in its imports. */
export async function findImportOnlyPaths({
  paths,
  readBase,
  readCurrent
}: {
  paths: readonly string[]
  readBase: (path: string) => Promise<string | null>
  readCurrent: (path: string) => Promise<string | null>
}): Promise<string[]> {
  const candidates = paths.slice(0, MAX_PATHS)
  const importOnly = new Set<string>()
  for (let start = 0; start < candidates.length; start += PARALLEL_READS) {
    await Promise.all(
      candidates.slice(start, start + PARALLEL_READS).map(async (path) => {
        const [before, after] = await Promise.all([
          readBase(path).catch(() => null),
          readCurrent(path).catch(() => null)
        ])
        if (
          before !== null &&
          after !== null &&
          before.length <= MAX_FILE_CHARS &&
          after.length <= MAX_FILE_CHARS &&
          isImportOnlyChange(path, before, after)
        ) {
          importOnly.add(path)
        }
      })
    )
  }
  return candidates.filter((path) => importOnly.has(path))
}

export function importOnlyPathsInWorktree(
  worktreePath: string,
  mergeBase: string,
  paths: readonly string[],
  options: GitRuntimeOptions = {}
): Promise<string[]> {
  return findImportOnlyPaths({
    paths,
    readBase: (path) =>
      gitExecFileAsync(['show', `${mergeBase}:${path}`], {
        ...gitOptionsForWorktree(worktreePath, options),
        timeout: 10_000
      }).then((result) => result.stdout),
    readCurrent: (path) => readFile(join(worktreePath, path), 'utf8')
  })
}
