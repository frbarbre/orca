import type { Repo } from '../../../../../shared/repo-types'
import type { GitHubPRStack, PRInfo } from '../../../../../shared/github/pull-request-types'
import { GitHubPRStackMap, type GitHubPRStackMapProps } from '../GitHubPRStackMap'
import { useMergeGitHubPRStack } from './use-merge-github-pr-stack'

export function GitHubPRStackSection({
  repo,
  pr,
  stack,
  onOpenPullRequest,
  onMerged,
  onRebaseStack
}: {
  repo: Repo | null | undefined
  pr: PRInfo
  stack: GitHubPRStack
  onOpenPullRequest: GitHubPRStackMapProps['onOpenPullRequest']
  onMerged: () => unknown
  onRebaseStack?: () => void
}): React.JSX.Element {
  const { mergeStack, mergingStack } = useMergeGitHubPRStack({ repo, pr, onMerged })
  return (
    <GitHubPRStackMap
      stack={stack}
      currentPRNumber={pr.number}
      onOpenPullRequest={onOpenPullRequest}
      onMergeStack={mergeStack}
      mergingStack={mergingStack}
      onRebaseStack={onRebaseStack}
    />
  )
}
