import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import type { Repo } from '../../../../../shared/repo-types'
import type { GitHubPRStackEntry, PRInfo } from '../../../../../shared/github/pull-request-types'
import { resolveGitHubPRMergeMethods } from '../../../../../shared/github/pull-request-merge-methods'
import { buildGitHubPRStackMergeConfirmation } from '../github-pr-stack-confirmation'
import { mergeGitHubHostedReview } from '../hosted-review-github-actions'

export function useMergeGitHubPRStack({
  repo,
  pr,
  onMerged
}: {
  repo: Repo | null | undefined
  pr: PRInfo | null | undefined
  onMerged: () => unknown
}): { mergeStack: (top: GitHubPRStackEntry) => void; mergingStack: boolean } {
  const confirm = useConfirmationDialog()
  const [mergingStack, setMergingStack] = useState(false)
  const run = useCallback(
    async (top: GitHubPRStackEntry): Promise<void> => {
      if (!repo || !pr?.stack) {
        return
      }
      const method = resolveGitHubPRMergeMethods(pr.mergeMethodSettings ?? null).defaultMethod
      const confirmed = await confirm(
        buildGitHubPRStackMergeConfirmation({
          stack: { ...pr.stack, position: top.position },
          currentPRNumber: top.number,
          method,
          usesMergeQueue: pr.mergeQueueRequired === true
        })
      )
      if (!confirmed) {
        return
      }
      setMergingStack(true)
      try {
        const result = await mergeGitHubHostedReview({
          repo,
          prNumber: top.number,
          method,
          prRepo: pr.prRepo ?? null
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        await onMerged()
      } finally {
        setMergingStack(false)
      }
    },
    [confirm, onMerged, pr, repo]
  )
  return { mergeStack: (top) => void run(top), mergingStack }
}
