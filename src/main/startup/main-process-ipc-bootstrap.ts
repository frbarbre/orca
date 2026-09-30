import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { recoverLegacyWorkerTerminalsForRendererStartup } from './legacy-worker-renderer-recovery'
import { logStartupMilestone } from './startup-diagnostics'
import { mainProcessState as state } from './main-process-state'
import { resolveOpenedMarkdownDocuments } from './os-opened-markdown-files'
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
import { resolveGitHubAttachmentUrl, uploadReviewAsset } from '../github/review-asset-upload'
import type { UploadReviewAssetRequest } from '../../shared/github/review-asset'

export function registerMainProcessIpcHandlers(): void {
  // Why read per call rather than caching: dropping a theme file in and reloading the window is the
  // whole edit loop, and a cache would make it a restart instead.
  ipcMain.handle('editor-theme:getCustom', () => loadCustomEditorThemes())

  ipcMain.handle('review-status-rules:snapshot', (_event, request: ReviewStatusSnapshotRequest) =>
    getReviewStatusSnapshot(request)
  )

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
    'pending-review:update-comment',
    (_event, request: UpdatePublishedCommentRequest) => updatePublishedReviewComment(request)
  )

  ipcMain.handle('pending-review:asset-upload', (_event, request: UploadReviewAssetRequest) =>
    uploadReviewAsset(request)
  )
  ipcMain.handle('pending-review:asset-resolve', (_event, href: string) =>
    resolveGitHubAttachmentUrl(href)
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
  // Why separate from the first-window barrier: host Git needs the shell-PATH
  // generation and the managed WSL CLI registration, not a daemon PTY provider
  // or a hook-server bind. Bundling them made worktree hydration wait on a
  // terminal service it never calls.
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
  ipcMain.handle('app:recoverLegacyWorkerTerminalsForRendererStartup', () =>
    recoverLegacyWorkerTerminalsForRendererStartup({
      firstWindowStartupServicesReady: state.firstWindowStartupServicesReady,
      managedWslCliStartupBarrierReady: state.managedWslCliStartupBarrierReady,
      localPtyProviderStartupReady: state.localPtyProviderStartupReady,
      reconcile: async () => {
        await state.runtime?.refreshRestoredOrchestrationAuthority()
        return state.runtime?.reconcileLegacyWorkerTerminals({ materializeRenderer: true })
      },
      onDeferredRecoveryError: (error) => {
        console.warn('[orchestration] legacy worker provider-ready recovery failed', error)
      }
    })
  )
  // Why: the renderer pulls this once its ui:openSettings listener attaches, so a Settings request queued before mount isn't lost.
  ipcMain.handle('ui:consumePendingOpenSettings', (event) =>
    state.pendingOpenSettings.matches(event.sender.id, { consume: true })
  )
  ipcMain.handle('ui:consumePendingSkillShare', () => state.skillShareDeepLinks.consume())
  // Why: the renderer pulls this once its ui:openMarkdownFiles listener attaches, so a
  // cold-start "Open With" queued before mount still opens. The pull doubles as the proof
  // that the listener is live, which is what lets main start pushing.
  ipcMain.handle('ui:consumePendingMarkdownFileOpens', async () => {
    state.markdownFileOpenListenerReady = true
    const filePaths = state.osOpenedMarkdownFiles.consume()
    try {
      return await resolveOpenedMarkdownDocuments(filePaths)
    } catch (error) {
      // Why restored: the renderer never received these, so a later mount must still get them.
      state.osOpenedMarkdownFiles.restore(filePaths)
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
