import { useAppStore } from '@/store'
import { startFixChecksAgent } from '@/lib/fix-checks-agent-launch'
import { buildCiTriagePrompt, failedChecksToTriage } from '../../../shared/ci-triage'
import type { Repo } from '../../../shared/repo-types'
import type { PRCheckDetail } from '../../../shared/github/check-types'

const started = new Set<string>()

/**
 * Fork: when a repo with CI triage shows failed checks on a PR that has a workspace here, starts
 * one background agent for that failure to decide whether it is noise worth one rerun.
 */
export function maybeStartCiTriage(
  repo: Pick<Repo, 'id' | 'ciTriage'> | undefined,
  prNumber: number,
  branch: string,
  headSha: string | undefined,
  checks: readonly PRCheckDetail[]
): void {
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
  if (started.has(key)) {
    return
  }
  started.add(key)
  void startFixChecksAgent({
    repoId: repo.id,
    worktreeId: workspace.id,
    basePrompt: buildCiTriagePrompt({
      prNumber,
      headSha,
      failedChecks,
      hints: repo.ciTriage.hints
    }),
    launchSource: 'source_control_recovery',
    background: true
  })
}
