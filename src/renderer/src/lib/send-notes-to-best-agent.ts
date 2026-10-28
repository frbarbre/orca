import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getConnectionId } from '@/lib/connection-context'
import { getStructuredChatTabNames } from '@/runtime/structured-chat-name-observation'
import type { DiffComment } from '../../../shared/diff-comment-types'
import type { TuiAgent } from '../../../shared/tui-agent'
import { formatDiffCommentsForAgent } from '../../../shared/agent-note-prompt'
import { earlierInThreadFromStore } from './agent-notes'
import { pickAutoSendTarget } from './auto-send-target'
import { deriveNotesSendAgentTargets, type NotesSendAgentTarget } from './notes-send-agent-targets'
import { sendMessageToAgent } from './agent-message-send'
import { activeAgentNotesSendFailureMessage } from './active-agent-note-send-result'
import type { ActiveAgentNotesSendResult } from './active-agent-note-send-result'
import { resolveDefaultAgentForNewTab } from './agent-tab-shortcuts'
import { launchAgentInNewTab, type LaunchAgentInNewTabArgs } from './launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from './agent-launch-request-id'

export type SendNotesToBestAgentDeps = {
  pickTarget: (
    worktreeId: string
  ) => Pick<NotesSendAgentTarget, 'messageTarget' | 'tabTitle' | 'paneKey'> | null
  sendMessage: (args: {
    worktreeId: string
    target: NotesSendAgentTarget['messageTarget']
    prompt: string
  }) => Promise<ActiveAgentNotesSendResult>
  defaultAgent: (worktreeId: string) => TuiAgent | null
  launch: (args: LaunchAgentInNewTabArgs) => unknown
  earlierInThread: (worktreeId: string) => (note: DiffComment) => readonly DiffComment[]
  clearDelivered: (worktreeId: string, notes: readonly DiffComment[], paneKey?: string) => void
  notify: { success: (message: string) => void; error: (message: string) => void }
}

const defaultDeps: SendNotesToBestAgentDeps = {
  pickTarget: (worktreeId) => {
    const state = useAppStore.getState()
    const targets = deriveNotesSendAgentTargets(state, worktreeId, getStructuredChatTabNames())
    return pickAutoSendTarget(targets, state, worktreeId)
  },
  sendMessage: sendMessageToAgent,
  defaultAgent: (worktreeId) => {
    const state = useAppStore.getState()
    const connectionId = getConnectionId(worktreeId)
    return resolveDefaultAgentForNewTab({
      defaultTuiAgent: state.settings?.defaultTuiAgent,
      detectedAgentIds:
        typeof connectionId === 'string'
          ? state.remoteDetectedAgentIds[connectionId]
          : state.detectedAgentIds,
      disabledTuiAgents: state.settings?.disabledTuiAgents
    })
  },
  launch: launchAgentInNewTab,
  earlierInThread: earlierInThreadFromStore,
  clearDelivered: (worktreeId, notes, paneKey) =>
    void useAppStore.getState().clearDeliveredDiffComments(worktreeId, notes, paneKey),
  notify: { success: (message) => toast.success(message), error: (message) => toast.error(message) }
}

/**
 * Fork: a follow-up under a note goes straight to the agent Orca would pick for it, with the
 * thread as context, or to a newly started default agent when none is running — the same prompt
 * and target the note's send menu offers, without opening it.
 */
export async function sendNotesToBestAgent(
  {
    worktreeId,
    notes,
    groupId
  }: { worktreeId: string; notes: readonly DiffComment[]; groupId?: string },
  deps: SendNotesToBestAgentDeps = defaultDeps
): Promise<'sent' | 'launched' | 'failed' | 'no-agent'> {
  const prompt = formatDiffCommentsForAgent(notes, deps.earlierInThread(worktreeId))
  const delivered = (): void => deps.clearDelivered(worktreeId, notes)
  const target = deps.pickTarget(worktreeId)
  if (target) {
    const result = await deps.sendMessage({ worktreeId, target: target.messageTarget, prompt })
    if (result.status === 'sent') {
      deps.clearDelivered(worktreeId, notes, target.paneKey)
      deps.notify.success(
        translate('notesFollowUp.sent', 'Sent to {{agent}}', { agent: target.tabTitle })
      )
      return 'sent'
    }
    deps.notify.error(
      activeAgentNotesSendFailureMessage(result.status, {
        explicitTarget: true,
        ...(result.code ? { code: result.code } : {})
      })
    )
    return 'failed'
  }
  const agent = deps.defaultAgent(worktreeId)
  if (!agent) {
    deps.notify.error(
      translate(
        'notesFollowUp.noAgent',
        'No agent is running here and none is set up to start. Send it from the note instead.'
      )
    )
    return 'no-agent'
  }
  deps.launch({
    requestId: newAgentLaunchRequestId(),
    agent,
    worktreeId,
    ...(groupId ? { groupId } : {}),
    prompt,
    promptDelivery: 'submit-after-ready',
    launchSource: 'notes_send',
    promptKeptByCaller: true,
    onPromptDelivered: delivered
  })
  return 'launched'
}
