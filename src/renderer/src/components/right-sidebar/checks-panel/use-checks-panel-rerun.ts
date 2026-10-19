import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { rerunReviewChecks } from '@/lib/rerun-review-checks'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../../shared/repo-types'
import type { GitHubOwnerRepo } from '../../../../../shared/github/pull-request-types'

export function useChecksPanelRerun({
  provider,
  repo,
  pr,
  refresh
}: {
  provider: string | undefined
  repo: Repo | null | undefined
  pr: { number: number; headSha?: string; prRepo?: GitHubOwnerRepo } | null | undefined
  refresh: () => unknown
}): { rerunChecks?: (failedOnly: boolean) => void; isRerunningChecks: boolean } {
  const [isRerunningChecks, setIsRerunningChecks] = useState(false)
  const run = useCallback(
    async (failedOnly: boolean): Promise<void> => {
      if (!repo || !pr) {
        return
      }
      setIsRerunningChecks(true)
      try {
        const result = await rerunReviewChecks({
          repo,
          prNumber: pr.number,
          headSha: pr.headSha,
          prRepo: pr.prRepo,
          failedOnly
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(
          result.count === 1
            ? translate('auto.components.PullRequestPage.5963a6a852', 'Check rerun requested')
            : translate('auto.components.PullRequestPage.18f2af42ac', 'Check reruns requested')
        )
        await refresh()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : translate('auto.components.PullRequestPage.788a782bb0', 'Failed to rerun checks')
        )
      } finally {
        setIsRerunningChecks(false)
      }
    },
    [pr, refresh, repo]
  )
  const rerunChecks = useCallback((failedOnly: boolean) => void run(failedOnly), [run])
  return {
    rerunChecks: provider === 'github' && repo && pr ? rerunChecks : undefined,
    isRerunningChecks
  }
}
