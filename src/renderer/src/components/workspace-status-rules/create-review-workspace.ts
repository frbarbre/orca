import { useAppStore } from '@/store'
import { resolveGitHubPrStartPointForRepo } from '@/lib/github-pr-start-point'
import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import { ensureHooksConfirmed } from '@/lib/ensure-hooks-confirmed'
import { launchWorktreeBackgroundTerminals } from '@/lib/launch-worktree-background-terminals'
import type { ReviewSnapshotPullRequest } from '../../../../shared/github/review-status-snapshot-types'
import type { WorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import {
  buildReviewPromptVariables,
  renderWorkspaceStatusRulePrompt
} from '../../../../shared/workspace-status-rule-prompt'
import { translate } from '@/i18n/i18n'

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
  config: WorkspaceStatusRuleConfig,
  /** A re-requested review opens on what changed since you last looked. */
  sinceReviewCommit?: string
): Promise<{ ok: true; worktreeId: string } | { ok: false; error: string }> {
  const repoId = findRepoIdForPullRequest(pr, config.repoIds)
  if (!repoId) {
    return {
      ok: false,
      error: translate(
        'auto.components.workspaceStatusRules.noMatchingProject',
        'No selected project matches {{repo}}.',
        { repo: `${pr.repo.owner}/${pr.repo.repo}` }
      )
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
    // Why the trust check: setup runs the orca.yaml checked out from the pull request, so it gets
    // the same gate as a workspace created by hand -- a trusted script runs without asking, and a
    // changed one prompts instead of running someone else's commands.
    const setupDecision = await ensureHooksConfirmed(store, repoId, 'setup')
    const created = await store.createWorktree(
      repoId,
      reviewWorkspaceName(pr),
      startPoint.baseBranch,
      setupDecision,
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
      sinceReviewCommit ?? startPoint.compareBaseRef
    )
    // Why here and not left to main: main only writes the setup runner; like every other create
    // path, the caller opens the Setup tab. Not awaited, so the review agent starts alongside it.
    if (created.setup || created.defaultTabs) {
      void launchWorktreeBackgroundTerminals({
        worktreeId: created.worktree.id,
        setup: created.setup,
        defaultTabs: created.defaultTabs
      }).catch((error) => {
        console.warn('[workspace-status-rules] review workspace setup failed:', error)
      })
    }
    await launchAgentBackgroundSession({
      agent: config.reviewInbox.agent,
      worktreeId: created.worktree.id,
      // Why a second template: a re-request is a different job from a first read — the
      // question is what the author did about what you already said.
      prompt: renderWorkspaceStatusRulePrompt(
        sinceReviewCommit
          ? config.reviewInbox.rereviewPromptTemplate
          : config.reviewInbox.promptTemplate,
        buildReviewPromptVariables(pr, sinceReviewCommit)
      ),
      launchSource: 'unknown',
      title: translate(
        'auto.components.workspaceStatusRules.reviewTabTitle',
        'Review #{{number}}',
        {
          number: pr.number
        }
      )
    })
    return { ok: true, worktreeId: created.worktree.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
