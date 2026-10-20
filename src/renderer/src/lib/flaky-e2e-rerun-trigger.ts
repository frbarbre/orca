import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../shared/repo-types'
import type { PRCheckDetail } from '../../../shared/github/check-types'
import type { GitHubRepositoryIdentity } from '../../../shared/github/pull-request-types'

const FAILED = new Set(['failure', 'timed_out'])
const asked = new Set<string>()

/**
 * Fork: when a repo set up for it shows failed checks, asks main once per failure whether to
 * rerun CI because every failed e2e test is a known flake on main.
 */
export function maybeRerunKnownFlakyE2e(
  repo: Pick<Repo, 'id' | 'flakyE2eRerun'> | undefined,
  prNumber: number,
  headSha: string | undefined,
  prRepo: GitHubRepositoryIdentity | null | undefined,
  checks: readonly PRCheckDetail[]
): void {
  if (!repo?.flakyE2eRerun || typeof window.api?.pendingReview?.flakyE2eRerun !== 'function') {
    return
  }
  const failed = checks
    .filter((check) => check.status === 'completed' && FAILED.has(check.conclusion ?? ''))
    .map((check) => check.name)
    .sort()
  if (failed.length === 0) {
    return
  }
  const key = JSON.stringify([repo.id, prNumber, headSha ?? '', failed])
  if (asked.has(key)) {
    return
  }
  asked.add(key)
  void window.api.pendingReview
    .flakyE2eRerun({ repoId: repo.id, prNumber, headSha, prRepo: prRepo ?? null })
    .then((outcomes) => {
      if (outcomes.some((outcome) => outcome.rerun)) {
        toast.success(
          translate(
            'flakyE2eRerun.rerun',
            'Reran CI on #{{value0}}: the failed e2e tests already fail on main.',
            { value0: String(prNumber) }
          )
        )
      }
    })
    .catch(() => {})
}
