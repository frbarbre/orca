import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../shared/layout-owner-switch'
import { placeUnshownLiveTerminalsBestEffort } from '../runtime/terminal/adoption/unshown-live-terminal-placement'
import { recoverLegacyWorkerTerminalsForRendererStartup } from './legacy-worker-renderer-recovery'
import { logStartupMilestone } from './startup-diagnostics'
import { mainProcessState as state } from './main-process-state'
import { loadCustomEditorThemes } from '../editor-theme/custom-editor-theme'
import { getReviewStatusSnapshot } from '../github/review-status-snapshot'
import { resolveReviewBase } from '../github/review-base'
import type { ResolveReviewBaseRequest } from '../../shared/github/review-base'
import { resolveRegisteredWorktreePath } from '../ipc/registered-worktree-roots-cache'
import { getLocalGitOptionsForRegisteredWorktree } from '../ipc/local-worktree-runtime-options'
import { getPullRequestReviewContext, submitReviewVerdict } from '../github/submit-review-verdict'
import { updatePublishedReviewComment } from '../github/update-published-comment'
import {
  readPendingReviewDrafts,
  writePendingReviewDrafts,
  readPendingReviewSummaries,
  writePendingReviewSummary
} from '../github/pending-review-draft-store'
import type {
  PendingReviewComment,
  SubmitReviewVerdictRequest,
  UpdatePublishedCommentRequest
} from '../../shared/github/pending-review-comment'
import type { ReviewStatusSnapshotRequest } from '../../shared/github/review-status-snapshot-types'
import type { SyncReviewHeadRequest } from '../../shared/github/review-head-sync'
import { syncReviewHead } from '../github/review-head-sync'
import type { WorkspaceCommandRequest } from '../../shared/github/workspace-command'
import { runWorkspaceCommand } from '../github/workspace-command'
import { resolveGitHubAttachmentUrl, uploadReviewAsset } from '../github/review-asset-upload'
import { getGitHubUserProfile } from '../github/github-user-profile'
import { registerSettingsTransferHandlers } from '../settings-transfer/settings-transfer'
import type { UploadReviewAssetRequest } from '../../shared/github/review-asset'
import {
  consumeQuitAndStopAllSessionsRequest,
  quitAfterRendererStoppedAllSessions
} from './main-window-actions'
import { resolveOsOpenedDocuments } from './os-opened-documents'
import {
  onStructuredAgentSessionsHeldChanged,
  structuredAgentSessionsHeld
} from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { subscribeAgentSessionUploadRemoval } from '../native-chat/agent-session-attachments/agent-session-attachment-store-registry'

export function registerMainProcessIpcHandlers(): void {
  // Why read per call rather than caching: dropping a theme file in and reloading the window is the
  // whole edit loop, and a cache would make it a restart instead.
  ipcMain.handle('editor-theme:getCustom', () => loadCustomEditorThemes())

  ipcMain.handle('review-status-rules:snapshot', (_event, request: ReviewStatusSnapshotRequest) =>
    getReviewStatusSnapshot(request)
  )

  registerSettingsTransferHandlers()

  ipcMain.handle('pending-review:submit', (_event, request: SubmitReviewVerdictRequest) =>
    submitReviewVerdict(request)
  )

  // Why a file of its own on this device: queued comments are the reviewer's, not the
  // workspace's, and a workspace on a remote runtime keeps its metadata on that runtime — whose
  // schema, if it runs upstream Orca, has no field for them and silently drops them.
  const pendingReviewDraftFile = (): string =>
    join(app.getPath('userData'), 'pending-review-drafts.json')
  ipcMain.handle('pending-review:summaries-read', () =>
    readPendingReviewSummaries(pendingReviewDraftFile())
  )
  ipcMain.handle('pending-review:summary-write', (_event, worktreeId: string, text: string) =>
    writePendingReviewSummary(pendingReviewDraftFile(), worktreeId, text)
  )
  ipcMain.handle('pending-review:drafts-read', () =>
    readPendingReviewDrafts(pendingReviewDraftFile())
  )
  ipcMain.handle(
    'pending-review:drafts-write',
    (_event, worktreeId: string, comments: PendingReviewComment[]) =>
      writePendingReviewDrafts(pendingReviewDraftFile(), worktreeId, comments)
  )

  // Why the registered-path check: the path comes from the renderer, and git runs in it.
  ipcMain.handle(
    'pending-review:resolve-base',
    async (_event, request: ResolveReviewBaseRequest) => {
      const store = state.store
      if (!store) {
        throw new Error('The store is not ready.')
      }
      const worktreePath = await resolveRegisteredWorktreePath(request.worktreePath, store)
      return resolveReviewBase(
        { ...request, worktreePath },
        getLocalGitOptionsForRegisteredWorktree(store, request.worktreePath, worktreePath)
      )
    }
  )

  ipcMain.handle(
    'review-status-rules:sync-review-head',
    async (_event, request: SyncReviewHeadRequest) => {
      const store = state.store
      if (!store) {
        throw new Error('The store is not ready.')
      }
      const worktreePath = await resolveRegisteredWorktreePath(request.worktreePath, store)
      return syncReviewHead(
        { ...request, worktreePath },
        getLocalGitOptionsForRegisteredWorktree(store, request.worktreePath, worktreePath)
      )
    }
  )

  ipcMain.handle(
    'review-status-rules:run-workspace-command',
    async (_event, request: WorkspaceCommandRequest) => {
      const store = state.store
      if (!store) {
        throw new Error('The store is not ready.')
      }
      const worktreePath = await resolveRegisteredWorktreePath(request.worktreePath, store)
      return runWorkspaceCommand(request.command, worktreePath)
    }
  )

  ipcMain.handle(
    'pending-review:update-comment',
    (_event, request: UpdatePublishedCommentRequest) => updatePublishedReviewComment(request)
  )

  ipcMain.handle('pending-review:asset-upload', (_event, request: UploadReviewAssetRequest) =>
    uploadReviewAsset(request)
  )
  ipcMain.handle('pending-review:asset-resolve', (_event, href: string) =>
    resolveGitHubAttachmentUrl(href)
  )
  ipcMain.handle('pending-review:user-profile', (_event, login: string) =>
    getGitHubUserProfile(login)
  )

  ipcMain.handle(
    'pending-review:context',
    (_event, request: Parameters<typeof getPullRequestReviewContext>[0]) =>
      getPullRequestReviewContext(request)
  )

  ipcMain.handle('app:awaitFirstWindowStartupServices', async () => {
    await Promise.all([
      state.firstWindowStartupServicesReady,
      state.managedWslCliStartupBarrierReady
    ])
  })
  // Git needs shell PATH/WSL registration, not daemon/hooks; separate barriers keep worktree hydration off terminal startup.
  ipcMain.handle('app:awaitGitEnvironmentStartupBarrier', async () => {
    await Promise.all([state.shellPathReady, state.managedWslCliStartupBarrierReady])
  })
  ipcMain.handle('app:prepareTerminalStartupRestoration', async () => {
    await Promise.all([
      state.firstWindowStartupServicesReady,
      state.managedWslCliStartupBarrierReady
    ])
    await state.runtime?.prepareStructuredAgentSessionStartupRestoration()
  })
  // Only hosts holding a saved/new structured chat have local rows for the renderer to mirror.
  ipcMain.handle('app:holdsStructuredAgentSessions', () => structuredAgentSessionsHeld())
  onStructuredAgentSessionsHeldChanged((held) => {
    const window = state.mainWindow
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send('app:structuredAgentSessionsHeldChanged', held)
    }
  })
  // Draft restore checks pastes only once; notify when a later sweep removes them.
  subscribeAgentSessionUploadRemoval((uploadDir) => {
    const window = state.mainWindow
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send('app:agentSessionUploadRemoved', uploadDir)
    }
  })
  ipcMain.handle('app:recoverLegacyWorkerTerminalsForRendererStartup', () =>
    recoverLegacyWorkerTerminalsForRendererStartup({
      firstWindowStartupServicesReady: state.firstWindowStartupServicesReady,
      managedWslCliStartupBarrierReady: state.managedWslCliStartupBarrierReady,
      localPtyProviderStartupReady: state.localPtyProviderStartupReady,
      reconcile: async () => {
        try {
          await state.runtime?.refreshRestoredOrchestrationAuthority()
          return await state.runtime?.reconcileLegacyWorkerTerminals({ materializeRenderer: true })
        } finally {
          // Main adopts unshown terminals after worker recovery attempts, even failures; the window no longer does.
          if (ORCA_LAYOUT_OWNER_IS_MAIN) {
            await placeUnshownLiveTerminalsBestEffort(state.runtime)
          }
        }
      },
      onDeferredRecoveryError: (error) => {
        console.warn('[orchestration] legacy worker provider-ready recovery failed', error)
      }
    })
  )
  // Renderer pulls after listener mount so early Settings requests survive.
  ipcMain.handle('ui:consumePendingOpenSettings', (event) =>
    state.pendingOpenSettings.matches(event.sender.id, { consume: true })
  )
  ipcMain.handle('ui:consumePendingQuitAndStopAllSessions', (event) =>
    consumeQuitAndStopAllSessionsRequest(event.sender.id)
  )
  ipcMain.handle('ui:quitAfterStoppingAllSessions', (event) =>
    quitAfterRendererStoppedAllSessions(event.sender.id)
  )
  ipcMain.handle('ui:consumePendingSkillShare', () => state.skillShareDeepLinks.consume())
  // Pull delivers cold-start Open With and proves the listener is ready for later pushes.
  ipcMain.handle('ui:consumePendingMarkdownFileOpens', async () => {
    state.osDocumentOpenListenerReady = true
    const filePaths = state.osOpenedDocuments.consume()
    try {
      return await resolveOsOpenedDocuments(filePaths)
    } catch (error) {
      // Restore undelivered paths so a later renderer mount can retry.
      state.osOpenedDocuments.restore(filePaths)
      throw error
    }
  })
  ipcMain.handle(
    'app:startupDiagnostic',
    (_event, event: string, details?: Record<string, unknown>) => {
      if (!state.startupDiagnosticsEnabled || !event.startsWith('renderer-')) {
        return
      }
      logStartupMilestone(event, details && typeof details === 'object' ? details : {})
    }
  )
}
