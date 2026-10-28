import { delimiter } from 'node:path'
import { spawnProcess } from '@orca/process-host'
import { forceTerminateProcessTree } from '@orca/process-host/process-tree-termination'
import type { EditorDiagnostic } from '../../shared/editor-diagnostics'
import type { LanguageServerLaunch } from './language-server-launchers'
import { createLspSession, type LspSession } from './lsp-session'

export function languageServerEnvironment(
  { env, pathPrefix }: Pick<LanguageServerLaunch, 'env' | 'pathPrefix'>,
  base: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  if (Object.keys(env).length === 0 && pathPrefix.length === 0) {
    return base
  }
  return {
    ...base,
    ...env,
    PATH: [...pathPrefix, base.PATH].filter(Boolean).join(delimiter)
  }
}

export function startLanguageServerSession(
  launch: Omit<LanguageServerLaunch, 'language'>,
  onDiagnostics?: (filePath: string, diagnostics: EditorDiagnostic[]) => void
): LspSession {
  const child = spawnProcess({
    program: launch.program,
    args: launch.args,
    cwd: launch.projectRoot,
    env: languageServerEnvironment(launch, process.env),
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
    onDiagnostics,
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
