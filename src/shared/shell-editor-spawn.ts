import { recognizeAgentProcessFromCommandLine } from './agent-process-recognition'

/** Mirrors main's SHELL_EDITOR_REQUEST_ENV; main turns it into the zsh wrapper's `editor` feature. */
const SHELL_EDITOR_REQUEST_ENV = 'ORCA_SHELL_EDITOR'

export type ShellEditorSpawnInput = {
  enabled: boolean
  isWindows: boolean
  connectionId: string | null | undefined
  command: string | undefined
  launchAgent: unknown
  launchConfig: unknown
  resumeProviderSession: unknown
}

/** Whether a shell this spawn starts, fresh or cold-restored under a saved session id, gets the editor. */
export function wantsShellEditor(input: ShellEditorSpawnInput): boolean {
  return (
    input.enabled &&
    !input.isWindows &&
    !input.connectionId &&
    !recognizeAgentProcessFromCommandLine(input.command) &&
    !input.launchAgent &&
    !input.launchConfig &&
    !input.resumeProviderSession
  )
}

export function shellEditorSpawnEnv(
  input: ShellEditorSpawnInput & { env: Record<string, string> | undefined }
): Record<string, string> | undefined {
  return wantsShellEditor(input) ? { ...input.env, [SHELL_EDITOR_REQUEST_ENV]: '1' } : input.env
}
