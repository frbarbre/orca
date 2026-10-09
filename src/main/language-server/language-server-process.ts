import { delimiter, join } from 'node:path'
import { spawnProcess } from '../../shared/child-process/run-process'
import { forceTerminateProcessTree } from '../../shared/child-process/process-tree-termination'
import type { LanguageServerLaunch } from './language-server-service'
import { createLspSession, type LspSession } from './lsp-session'

export function languageServerEnvironment(
  venvPath: string | null,
  base: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  if (!venvPath) {
    return base
  }
  // Why VIRTUAL_ENV: pyrefly picks its interpreter (and so site-packages) from the active venv.
  return {
    ...base,
    VIRTUAL_ENV: venvPath,
    PATH: [join(venvPath, 'bin'), base.PATH].filter(Boolean).join(delimiter)
  }
}

export function startLanguageServerSession(launch: LanguageServerLaunch): LspSession {
  const child = spawnProcess({
    program: launch.program,
    args: launch.args,
    cwd: launch.projectRoot,
    env: languageServerEnvironment(launch.venvPath, process.env),
    detached: process.platform !== 'win32'
  })
  // Why: an unhandled stream error crashes main; a write racing the server's exit raises EPIPE.
  for (const stream of [child.stdin, child.stdout, child.stderr]) {
    stream.on('error', () => {})
  }
  child.stderr.resume()
  return createLspSession({
    rootPath: launch.projectRoot,
    serverName: launch.serverName,
    transport: {
      write: (chunk) => {
        if (child.stdin.writable) {
          child.stdin.write(chunk)
        }
      },
      onData: (listener) => child.stdout.on('data', listener),
      onExit: (listener) => {
        child.once('error', listener)
        child.once('close', listener)
      },
      kill: () => void forceTerminateProcessTree(child)
    }
  })
}
