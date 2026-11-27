import { shellEditorSpawnEnv } from '../../../../shared/shell-editor-spawn'
import type { TerminalCreateOptions } from '../../runtime-terminal-contracts'

/** Fork: shells main starts (CLI worktree setup, `orca terminal create`) get the editor too. */
export function withShellEditorRequest(
  store: { getSettings?: () => { terminalShellEditor?: boolean } } | null | undefined,
  workspace: { connectionId: string | null | undefined },
  launch: Pick<TerminalCreateOptions, 'command' | 'launchAgent' | 'launchConfig'>,
  env: Record<string, string>
): Record<string, string> {
  return (
    shellEditorSpawnEnv({
      enabled: store?.getSettings?.().terminalShellEditor ?? false,
      isWindows: process.platform === 'win32',
      connectionId: workspace.connectionId,
      command: launch.command,
      launchAgent: launch.launchAgent,
      launchConfig: launch.launchConfig,
      admittedSessionId: undefined,
      env
    }) ?? env
  )
}
