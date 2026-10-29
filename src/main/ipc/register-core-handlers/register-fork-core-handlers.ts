import type { KeybindingOverrides } from '../../../shared/keybindings'
import { registerLanguageServerHandlers } from '../language-server'
import { registerGitBlameHandlers } from '../git-blame'
import { registerMaterialIconHandlers } from '../material-icons'
import { registerAgentTurnHandlers } from '../agent-turns'
import { registerCiTriageLogHandlers } from '../ci-triage-log'
import { registerClaudeRemoteSessionHandlers } from '../claude-remote-session'

/** Fork: the fork's own IPC surfaces, kept out of upstream's handler list for its line cap. */
export function registerForkCoreHandlers(
  getKeybindingOverrides: () => KeybindingOverrides | undefined
): void {
  registerClaudeRemoteSessionHandlers(getKeybindingOverrides)
  registerLanguageServerHandlers()
  registerGitBlameHandlers()
  registerMaterialIconHandlers()
  registerAgentTurnHandlers()
  registerCiTriageLogHandlers()
}
