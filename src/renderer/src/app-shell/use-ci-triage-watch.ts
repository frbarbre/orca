import { useEffect } from 'react'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { getVisibleHostedReviewWorkspaces } from '@/store/github/visible-hosted-review-refresh-targets'
import { ciTriageFetchTargets } from '@/lib/ci-triage-watch'
import { maybeStartCiTriage } from '@/lib/ci-triage-trigger'

/**
 * Fork: CI triage starts from the same PR status that turns a workspace's icon red, not only
 * from an open PR tab. Fetching that PR's checks hands them to the triage trigger.
 */
export function useCiTriageWatch({ enabled }: { enabled: boolean }): void {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const fetched = new Set<string>()
    const check = (state: AppState): void => {
      for (const target of ciTriageFetchTargets(
        getVisibleHostedReviewWorkspaces(state),
        state.prCache
      )) {
        const key = JSON.stringify([target.repo.id, target.prNumber, target.headSha ?? ''])
        if (fetched.has(key)) {
          continue
        }
        fetched.add(key)
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
          .then((checks) => maybeStartCiTriage({ ...target, checks }))
          .catch(() => fetched.delete(key))
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
