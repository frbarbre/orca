import { recognizeAgentProcessFromCommandLine } from './agent-process-recognition'

/** Mirrors main's SHELL_EDITOR_REQUEST_ENV; main turns it into the zsh wrapper's `editor` feature. */
const SHELL_EDITOR_REQUEST_ENV = 'ORCA_SHELL_EDITOR'

/** The spawn env asking zsh for the editor, or null when this spawn is not a fresh local shell. */
export function shellEditorSpawnEnv(input: {
  enabled: boolean
  isWindows: boolean
  connectionId: string | null | undefined
  command: string | undefined
  launchAgent: unknown
  launchConfig: unknown
  admittedSessionId: string | undefined
  env: Record<string, string> | undefined
}): Record<string, string> | null {
  if (
    !input.enabled ||
    input.isWindows ||
    input.connectionId ||
    recognizeAgentProcessFromCommandLine(input.command) ||
    input.launchAgent ||
    input.launchConfig ||
    input.admittedSessionId
  ) {
    return null
  }
  return { ...input.env, [SHELL_EDITOR_REQUEST_ENV]: '1' }
}
