import { ipcMain } from 'electron'
import { parseFlakyE2eRerunConfig } from '../../shared/flaky-e2e-rerun'
import type { FlakyE2eRerunRequest } from '../../shared/github/flaky-e2e-rerun-request'
import { getLocalProjectWorktreeGitOptions } from '../project-runtime-git-options'
import {
  clearSentryApiKey,
  hasSentryApiKey,
  readSentryApiKey,
  saveSentryApiKey
} from '../sentry/sentry-api-key-store'
import type { mainProcessState } from '../startup/main-process-state'
import {
  considerFlakyE2eRerun,
  createFlakyE2eRerunDeps,
  type FlakyE2eRerunOutcome
} from './flaky-e2e-rerun'

const considered = new Set<string>()

async function consider(
  state: typeof mainProcessState,
  request: FlakyE2eRerunRequest
): Promise<FlakyE2eRerunOutcome[]> {
  const repo = state.store?.getRepo(request.repoId)
  const config = parseFlakyE2eRerunConfig(repo?.flakyE2eRerun)
  const sentryToken = readSentryApiKey()
  if (!state.store || !repo || !config || !sentryToken) {
    return []
  }
  const deps = await createFlakyE2eRerunDeps({
    repoPath: repo.path,
    prNumber: request.prNumber,
    headSha: request.headSha,
    prRepo: request.prRepo,
    connectionId: repo.connectionId,
    localGitOptions: getLocalProjectWorktreeGitOptions(state.store, repo),
    config,
    sentryToken
  })
  return deps ? considerFlakyE2eRerun(deps, considered) : []
}

export function registerFlakyE2eRerunHandlers(state: typeof mainProcessState): void {
  ipcMain.handle('pending-review:flaky-e2e-rerun', (_event, request: FlakyE2eRerunRequest) =>
    consider(state, request).catch((error: unknown) => {
      console.warn('[flaky-e2e-rerun] could not consider a rerun', error)
      return []
    })
  )
  ipcMain.handle('pending-review:sentry-token-configured', () => hasSentryApiKey())
  ipcMain.handle('pending-review:sentry-token-save', (_event, token: string) => {
    if (typeof token === 'string' && token.trim()) {
      saveSentryApiKey(token.trim())
    }
  })
  ipcMain.handle('pending-review:sentry-token-clear', () => clearSentryApiKey())
}
