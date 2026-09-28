import { useAppStore } from '@/store'
import { resolveGitHubPrStartPointForRepo } from '@/lib/github-pr-start-point'
import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import { ensureHooksConfirmed } from '@/lib/ensure-hooks-confirmed'
import { launchWorktreeBackgroundTerminals } from '@/lib/launch-worktree-background-terminals'
import { markReviewedCommit } from '@/lib/reviewed-commit-bases'
import type { ReviewSnapshotPullRequest } from '../../../../shared/github/review-status-snapshot-types'
import type { WorkspaceStatusRuleConfig } from '../../../../shared/workspace-status-rule-config'
import type { Worktree } from '../../../../shared/worktree/types'
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
    markReviewedCommit(sinceReviewCommit)
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
    const rebaseNote = sinceReviewCommit
      ? await pinInterdiffBase(created.worktree, sinceReviewCommit, pr)
      : ''
    await launchAgentBackgroundSession({
      agent: config.reviewInbox.agent,
      worktreeId: created.worktree.id,
      // Why a second template: a re-request is a different job from a first read — the
      // question is what the author did about what you already said.
      prompt:
        renderWorkspaceStatusRulePrompt(
          sinceReviewCommit
            ? config.reviewInbox.rereviewPromptTemplate
            : config.reviewInbox.promptTemplate,
          buildReviewPromptVariables(pr, sinceReviewCommit)
        ) + rebaseNote,
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

/**
 * When the branch moved onto a newer base since the review, points the workspace at the interdiff
 * base and returns
 * a note telling the agent how to diff against it; otherwise changes nothing and returns ''.
 *
 * Why the note: the reviewed commit is no longer in the branch, so the template's instruction to
 * diff against it would show everything the target branch gained, and a three-dot diff against
 * the interdiff base would too.
 */
async function pinInterdiffBase(
  worktree: Pick<Worktree, 'id' | 'path' | 'hostId'>,
  reviewedCommit: string,
  pr: ReviewSnapshotPullRequest
): Promise<string> {
  const resolveBase = window.api?.pendingReview?.resolveBase
  if (!resolveBase) {
    return ''
  }
  const base = await resolveBase({
    worktreePath: worktree.path,
    reviewedCommit,
    targetRef: `refs/remotes/origin/${pr.baseRefName}`
  }).catch(() => null)
  if (base?.kind !== 'interdiff') {
    return ''
  }
  await useAppStore
    .getState()
    .updateWorktreeMeta(
      worktree.id,
      { baseRef: base.baseRef },
      worktree.hostId ? { executionHostId: worktree.hostId } : undefined
    )
  return `\n\nThe branch moved onto a newer base after your review (rebased, or merged with its target branch), so diffing against ${reviewedCommit} would include everything that base gained. \`${base.baseRef}\` is the version you reviewed, replayed onto the branch's current base: run \`git diff ${base.baseRef} HEAD\` (two dots, not three) to see only what changed since your review.${base.conflicted ? ' Replaying it hit conflicts, so files marked with conflict markers there are ones both the rebase and the new commits touched; read them against HEAD.' : ''}`
}
