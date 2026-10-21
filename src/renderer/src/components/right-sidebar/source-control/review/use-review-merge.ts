import { useCallback } from 'react'
import { useAppStore } from '@/store'
import type { HostedReviewInfo } from '../../../../../../shared/hosted-review'
import type { PRInfo } from '../../../../../../shared/github/pull-request-types'
import type { Repo } from '../../../../../../shared/repo-types'
import {
  useHostedReviewMergeControls,
  type HostedReviewPrimaryMerge
} from '../../use-hosted-review-merge-controls'

const NO_REVIEW: HostedReviewInfo = {
  provider: 'github',
  number: 0,
  title: '',
  state: 'closed',
  url: '',
  status: 'neutral',
  updatedAt: '',
  mergeable: 'UNKNOWN'
}
const NO_REPO = { id: '', path: '' } as Repo

/** The PR panel's merge button for this branch's open GitHub PR, for Source Control's primary. */
export function useSourceControlReviewMerge({
  hostedReview,
  githubPR,
  repo,
  worktreeId,
  branchName
}: {
  hostedReview: HostedReviewInfo | null
  githubPR: PRInfo | null
  repo: Repo | null
  worktreeId: string | null
  branchName: string
}): HostedReviewPrimaryMerge | null {
  const fetchPRForBranch = useAppStore((state) => state.fetchPRForBranch)
  const usable = hostedReview?.provider === 'github' && repo !== null
  const onRefreshReview = useCallback(async () => {
    if (repo && branchName) {
      await fetchPRForBranch(repo.path, branchName, {
        force: true,
        repoId: repo.id,
        worktreeId: worktreeId ?? undefined
      })
    }
  }, [branchName, fetchPRForBranch, repo, worktreeId])
  // Why: hooks cannot be skipped, so without a usable review the controls run on a closed stand-in
  // that offers no merge.
  const { primaryMerge } = useHostedReviewMergeControls({
    review: usable ? hostedReview : NO_REVIEW,
    githubPR: usable ? githubPR : null,
    repo: usable ? repo : NO_REPO,
    worktreeId,
    onRefreshReview
  })
  return usable ? primaryMerge : null
}
