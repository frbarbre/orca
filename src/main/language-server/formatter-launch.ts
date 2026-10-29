import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import {
  FORMATTERS,
  formatterForFile,
  type FormatRequest,
  type FormatterId
} from '../../shared/formatter'
import { expandHome, type LanguageServerLaunch } from './language-server-launchers'
import { resolvePythonProject } from './python-project-resolution'
import { directoriesUpTo } from './typescript-project-resolution'

export type FormatterLaunch = Omit<LanguageServerLaunch, 'language'> & { formatter: FormatterId }

export type FormatterFiles = {
  exists: (path: string) => boolean
  read: (path: string) => string | null
}

type LaunchRequest = Omit<FormatRequest, 'text' | 'tabSize' | 'insertSpaces'>

function hasConfig(formatter: FormatterId, dir: string, { exists, read }: FormatterFiles): boolean {
  const spec = FORMATTERS[formatter]
  if (spec.configFiles.some((file) => exists(join(dir, file)))) {
    return true
  }
  const table = 'pyprojectTable' in spec ? spec.pyprojectTable : null
  return table !== null && (read(join(dir, 'pyproject.toml'))?.includes(table) ?? false)
}

// Why the project's own copy first: it matches the version and config the repo formats with.
function binDirs(request: LaunchRequest, projectRoot: string, exists: FormatterFiles['exists']) {
  const { formatter, filePath, worktreeRoot, repoRoot, venvSetting } = request
  if (formatter === 'ruff') {
    const { venvPath } = resolvePythonProject({
      filePath,
      worktreeRoot,
      repoRoot,
      venvSetting,
      exists
    })
    return venvPath ? [join(venvPath, 'bin')] : []
  }
  const searchDirs = directoriesUpTo(projectRoot, worktreeRoot)
  if (repoRoot && repoRoot !== worktreeRoot) {
    searchDirs.push(
      ...directoriesUpTo(join(repoRoot, relative(worktreeRoot, projectRoot)), repoRoot)
    )
  }
  return searchDirs.map((dir) => join(dir, 'node_modules', '.bin'))
}

export function resolveFormatterLaunch(
  request: LaunchRequest,
  files: FormatterFiles,
  home: string = homedir()
): FormatterLaunch | null {
  const { formatter, command, filePath, worktreeRoot } = request
  if (formatterForFile(filePath) !== formatter) {
    return null
  }
  const projectRoot = directoriesUpTo(dirname(filePath), worktreeRoot).find((dir) =>
    hasConfig(formatter, dir, files)
  )
  if (!projectRoot) {
    return null
  }
  const spec = FORMATTERS[formatter]
  const program = command
    ? expandHome(command, home)
    : (binDirs(request, projectRoot, files.exists)
        .map((dir) => join(dir, spec.command))
        .find(files.exists) ?? spec.command)
  return {
    formatter,
    serverName: spec.name,
    projectRoot,
    program,
    args: [...spec.args],
    env: {},
    pathPrefix: []
  }
}
