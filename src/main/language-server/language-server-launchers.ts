import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  LANGUAGE_SERVERS,
  languageServerOptions,
  type LanguageServerLanguage,
  type LanguageServerRequest
} from '../../shared/language-server'
import { resolvePythonProject } from './python-project-resolution'
import { resolveTypeScriptProject } from './typescript-project-resolution'

export type LanguageServerLaunch = {
  language: LanguageServerLanguage
  serverName: string
  projectRoot: string
  program: string
  args: string[]
  env: Record<string, string>
  pathPrefix: string[]
}

type LanguageProject = {
  projectRoot: string
  /** Where the project's own tools live, searched for the server before PATH. */
  binDirs: string[]
  env: Record<string, string>
  pathPrefix: string[]
}

const PROJECTS: Record<
  LanguageServerLanguage,
  (request: LanguageServerRequest, exists: (path: string) => boolean) => LanguageProject
> = {
  python: ({ filePath, worktreeRoot, repoRoot, venvSetting }, exists) => {
    const { projectRoot, venvPath } = resolvePythonProject({
      filePath,
      worktreeRoot,
      repoRoot,
      venvSetting,
      exists
    })
    const venvBin = venvPath ? [join(venvPath, 'bin')] : []
    const env: Record<string, string> = venvPath ? { VIRTUAL_ENV: venvPath } : {}
    // Why VIRTUAL_ENV and PATH: Python servers pick their interpreter, and so site-packages, from
    // the active venv.
    return {
      projectRoot,
      binDirs: venvBin,
      env,
      pathPrefix: venvBin
    }
  },
  typescript: ({ filePath, worktreeRoot, repoRoot }, exists) => ({
    ...resolveTypeScriptProject({ filePath, worktreeRoot, repoRoot, exists }),
    env: {},
    pathPrefix: []
  })
}

// Why: a spawned program gets no shell, so nothing else expands a typed `~/`.
export function expandHome(command: string, home: string): string {
  return command === '~' || command.startsWith('~/') ? join(home, command.slice(1)) : command
}

export function resolveLaunch(
  request: LanguageServerRequest,
  exists: (path: string) => boolean,
  home: string = homedir()
): LanguageServerLaunch {
  const { language } = request
  const servers = languageServerOptions(language)
  const server = servers[request.server] ?? servers[LANGUAGE_SERVERS[language].defaultServer]
  const { binDirs, ...project } = PROJECTS[language](request, exists)
  const program = request.command
    ? expandHome(request.command, home)
    : (binDirs.map((dir) => join(dir, server.command)).find(exists) ?? server.command)
  return { language, serverName: server.name, program, args: [...server.args], ...project }
}
