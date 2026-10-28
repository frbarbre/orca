import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { LINTERS, lintersForFile, type LintRequest, type LinterId } from '../../shared/linter'
import { expandHome, type LanguageServerLaunch } from './language-server-launchers'
import { directoriesUpTo } from './typescript-project-resolution'

export type LinterLaunch = Omit<LanguageServerLaunch, 'language'> & { linter: LinterId }

export function resolveLinterLaunch(
  { linter, command, filePath, worktreeRoot, repoRoot }: Omit<LintRequest, 'text'>,
  exists: (path: string) => boolean,
  home: string = homedir()
): LinterLaunch | null {
  if (!lintersForFile(filePath).includes(linter)) {
    return null
  }
  const spec = LINTERS[linter]
  const projectRoot = directoriesUpTo(dirname(filePath), worktreeRoot).find((dir) =>
    spec.configFiles.some((file) => exists(join(dir, file)))
  )
  if (!projectRoot) {
    return null
  }
  const searchDirs = directoriesUpTo(projectRoot, worktreeRoot)
  if (repoRoot && repoRoot !== worktreeRoot) {
    searchDirs.push(
      ...directoriesUpTo(join(repoRoot, relative(worktreeRoot, projectRoot)), repoRoot)
    )
  }
  // Why the project's own copy first: it matches the version and plugins the repo lints with.
  const program = command
    ? expandHome(command, home)
    : (searchDirs.map((dir) => join(dir, 'node_modules', '.bin', spec.command)).find(exists) ??
      spec.command)
  return {
    linter,
    serverName: spec.name,
    projectRoot,
    program,
    args: [...spec.args],
    env: {},
    pathPrefix: []
  }
}
