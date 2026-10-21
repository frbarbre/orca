import { useAppStore } from '@/store'
import { startFixChecksAgent } from '@/lib/fix-checks-agent-launch'
import {
  buildCiTriagePrompt,
  ciTriageInstructions,
  failedChecksToTriage
} from '../../../shared/ci-triage'
import type { Repo } from '../../../shared/repo-types'
import type { PRCheckDetail } from '../../../shared/github/check-types'
import type { GitHubOwnerRepo } from '../../../shared/github/pull-request-types'

const started = new Set<string>()
const startsByPr = new Map<string, number>()
const MAX_TRIAGES_PER_PR = 3

async function viewerAuthoredPR(
  repo: Pick<Repo, 'path' | 'connectionId'>,
  prNumber: number,
  prRepo: GitHubOwnerRepo | null
): Promise<boolean> {
  try {
    const context = await window.api.pendingReview.context({
      repoPath: repo.path,
      prNumber,
      prRepo,
      connectionId: repo.connectionId ?? null
    })
    return context.viewerDidAuthor
  } catch {
    return false
  }
}

/**
 * Fork: when a repo with CI triage shows failed checks on a PR you wrote that has a workspace
 * here, starts one background agent for that failure to rerun noise once or push a clear fix.
 */
export async function maybeStartCiTriage({
  repo,
  prNumber,
  prRepo,
  branch,
  headSha,
  checks
}: {
  repo: Pick<Repo, 'id' | 'path' | 'connectionId' | 'ciTriage'> | undefined
  prNumber: number
  prRepo: GitHubOwnerRepo | null
  branch: string
  headSha: string | undefined
  checks: readonly PRCheckDetail[]
}): Promise<void> {
  if (!repo?.ciTriage) {
    return
  }
  const failedChecks = failedChecksToTriage(checks)
  if (failedChecks.length === 0) {
    return
  }
  const workspace = useAppStore
    .getState()
    .allWorktrees()
    .find(
      (worktree) =>
        worktree.repoId === repo.id && worktree.branch.replace(/^refs\/heads\//, '') === branch
    )
  if (!workspace) {
    return
  }
  const key = JSON.stringify([
    repo.id,
    prNumber,
    headSha ?? '',
    failedChecks.map((check) => check.name)
  ])
  const prKey = JSON.stringify([repo.id, prNumber])
  const prStarts = startsByPr.get(prKey) ?? 0
  // Why: each pushed fix is a new head, so a fix that keeps failing would otherwise triage forever.
  if (started.has(key) || prStarts >= MAX_TRIAGES_PER_PR) {
    return
  }
  started.add(key)
  startsByPr.set(prKey, prStarts + 1)
  if (!(await viewerAuthoredPR(repo, prNumber, prRepo))) {
    return
  }
  void startFixChecksAgent({
    repoId: repo.id,
    worktreeId: workspace.id,
    basePrompt: buildCiTriagePrompt({
      prNumber,
      headSha,
      failedChecks,
      instructions: ciTriageInstructions(repo.ciTriage)
    }),
    launchSource: 'source_control_recovery',
    background: true
  })
}
