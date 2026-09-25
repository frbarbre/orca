import { useAppStore } from '@/store'
import { resolveGitHubPrStartPointForRepo } from '@/lib/github-pr-start-point'
import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import type { ReviewSnapshotPullRequest } from '../../../../shared/github/review-status-snapshot-types'
import type { WorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import {
  buildReviewPromptVariables,
  renderWorkspaceStatusRulePrompt
} from '../../../../shared/workspace-status-rule-prompt'

function reviewWorkspaceName(pr: ReviewSnapshotPullRequest): string {
  const slug = pr.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `review-${pr.number}${slug ? `-${slug}` : ''}`
}

// Why only the configured projects: a review request must land in a project the
// rules were scoped to, never in some other checkout that happens to match.
function findRepoIdForPullRequest(
  pr: ReviewSnapshotPullRequest,
  repoIds: readonly string[]
): string | null {
  const wanted = `${pr.repo.owner}/${pr.repo.repo}`.toLowerCase()
  const scoped = useAppStore.getState().repos.filter((repo) => repoIds.includes(repo.id))
  const match = scoped.find(
    (repo) =>
      repo.path.toLowerCase().endsWith(wanted) ||
      `${repo.upstream?.owner}/${repo.upstream?.repo}`.toLowerCase() === wanted
  )
  return match?.id ?? scoped[0]?.id ?? null
}

export async function createReviewWorkspace(
  pr: ReviewSnapshotPullRequest,
  config: WorkspaceStatusRuleConfig
): Promise<{ ok: true; worktreeId: string } | { ok: false; error: string }> {
  const repoId = findRepoIdForPullRequest(pr, config.repoIds)
  if (!repoId) {
    return {
      ok: false,
      error: `No selected project matches ${pr.repo.owner}/${pr.repo.repo}.`
    }
  }
  const store = useAppStore.getState()
  try {
    const startPoint = await resolveGitHubPrStartPointForRepo({
      repoId,
      prNumber: pr.number,
      settings: store.settings,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName
    })
    const created = await store.createWorktree(
      repoId,
      reviewWorkspaceName(pr),
      startPoint.baseBranch,
      'skip',
      undefined,
      'unknown',
      pr.title,
      undefined,
      pr.number,
      startPoint.pushTarget,
      // Why: the review session below owns the prompt-bearing agent tab, so
      // createdWithAgent would only reopen an empty fallback beside it.
      undefined,
      undefined,
      startPoint.branchNameOverride,
      config.statusByCondition.reviewing,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      startPoint.compareBaseRef
    )
    await launchAgentBackgroundSession({
      agent: config.reviewInbox.agent,
      worktreeId: created.worktree.id,
      prompt: renderWorkspaceStatusRulePrompt(
        config.reviewInbox.promptTemplate,
        buildReviewPromptVariables(pr)
      ),
      launchSource: 'unknown',
      title: `Review #${pr.number}`
    })
    return { ok: true, worktreeId: created.worktree.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
