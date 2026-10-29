import { useEffect } from 'react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { getVisibleHostedReviewWorkspaces } from '@/store/github/visible-hosted-review-refresh-targets'
import { ciTriageFetchTargets } from '@/lib/ci-triage-watch'
import { maybeStartCiTriage } from '@/lib/ci-triage-trigger'

const LOOK_AGAIN_MS = 30_000

/**
 * Fork: CI triage starts from the same PR status that turns a workspace's icon red, not only
 * from an open PR tab. Fetching that PR's checks hands them to the triage trigger.
 */
export function useCiTriageWatch({ enabled }: { enabled: boolean }): void {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const lookedAt = new Map<string, number>()
    const check = (state: AppState): void => {
      for (const target of ciTriageFetchTargets(
        getVisibleHostedReviewWorkspaces(state),
        state.prCache
      )) {
        const key = JSON.stringify([target.repo.id, target.prNumber, target.headSha ?? ''])
        // Why: a PR turns red on its first failed check while others run, and later ones can fail
        // too, so keep looking while it stays red; the trigger starts once per failed run.
        if (Date.now() - (lookedAt.get(key) ?? -Infinity) < LOOK_AGAIN_MS) {
          continue
        }
        lookedAt.set(key, Date.now())
        void state
          .fetchPRChecks(
            target.repo.path,
            target.prNumber,
            target.branch,
            target.headSha,
            target.prRepo,
            { repoId: target.repo.id }
          )
          // Why: a cache hit returns before fetchPRChecks reaches the triage trigger.
          .then((checks) => maybeStartCiTriage({ ...target, checks, trigger: 'watch' }))
          .catch(() => lookedAt.delete(key))
      }
    }
    check(useAppStore.getState())
    return useAppStore.subscribe((state, previous) => {
      if (state.prCache !== previous.prCache || state.repos !== previous.repos) {
        check(state)
      }
    })
  }, [enabled])
}
