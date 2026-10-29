import { useAppStore } from '@/store'
import { startFixChecksAgent } from '@/lib/fix-checks-agent-launch'
import {
  buildCiTriagePrompt,
  ciTriageInstructions,
  failedChecksToTriage,
  type TriagedCheck
} from '../../../shared/ci-triage'
import type { CiTriageLogEntry, CiTriageTrigger } from '../../../shared/ci-triage-log'
import type { Repo } from '../../../shared/repo-types'
import type { PRCheckDetail } from '../../../shared/github/check-types'
import type { GitHubOwnerRepo } from '../../../shared/github/pull-request-types'

const MAX_TRIAGES_PER_PR = 3
const MEMORY_KEY = 'orca.ciTriage.memory'
const REMEMBER_MS = 7 * 24 * 60 * 60_000
const WINDOW_ID = new Date(performance.timeOrigin).toISOString()

/** Runs triaged and agents started per PR, each with when; kept so a restart starts none again. */
type Memory = {
  runs: Record<string, number>
  prStarts: Record<string, { count: number; at: number }>
}

function readMemory(now: number): Memory {
  let stored: Partial<Memory> = {}
  try {
    stored = JSON.parse(window.localStorage?.getItem(MEMORY_KEY) ?? '{}') as Partial<Memory>
  } catch {
    stored = {}
  }
  const fresh = <T>(entries: Record<string, T> | undefined, at: (value: T) => number) =>
    Object.fromEntries(
      Object.entries(entries ?? {}).filter(([, value]) => now - at(value) < REMEMBER_MS)
    )
  return {
    runs: fresh(stored.runs, (at) => at),
    prStarts: fresh(stored.prStarts, (start) => start.at)
  }
}

function writeMemory(memory: Memory): void {
  try {
    window.localStorage?.setItem(MEMORY_KEY, JSON.stringify(memory))
  } catch {
    // Why ignore: a full or blocked storage only costs the memory across a restart.
  }
}

const loggedSkips = new Set<string>()

function logDecision(entry: CiTriageLogEntry): void {
  // Why once per window: the watcher looks at a red PR every 30 s and would repeat each skip.
  if (entry.decision !== 'started' && !entry.decision.startsWith('launch')) {
    const key = JSON.stringify([entry.decision, entry.repoId, entry.prNumber, entry.headSha])
    if (loggedSkips.has(key)) {
      return
    }
    loggedSkips.add(key)
  }
  void window.api.ciTriage
    ?.log({ ...entry, at: new Date().toISOString(), window: WINDOW_ID })
    .catch(() => {})
}

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
  checks,
  trigger
}: {
  repo: Pick<Repo, 'id' | 'path' | 'connectionId' | 'ciTriage'> | undefined
  prNumber: number
  prRepo: GitHubOwnerRepo | null
  branch: string
  headSha: string | undefined
  checks: readonly PRCheckDetail[]
  trigger: CiTriageTrigger
}): Promise<void> {
  if (!repo?.ciTriage) {
    return
  }
  const failedChecks = failedChecksToTriage(checks)
  if (failedChecks.length === 0) {
    return
  }
  const base = { trigger, repoId: repo.id, prNumber, branch, headSha: headSha ?? null }
  const log = (decision: CiTriageLogEntry['decision'], extra: Partial<CiTriageLogEntry> = {}) =>
    logDecision({ ...base, failed: failedChecks, decision, ...extra })
  // Why: a status without a link, like a combined CI status, only sums up runs that failed
  // themselves; it has no log to read, and failing a minute later it started a second agent.
  const linked = failedChecks.filter((check) => check.url)
  if (linked.length === 0) {
    log('no-linked-failure')
    return
  }
  // Why: a failed check running again, as on a just-pushed fix, may turn the result around;
  // unrelated checks still running are no reason to hold back an early failure.
  const rerunning = new Set(
    checks.filter((check) => check.status !== 'completed').map((check) => check.name)
  )
  if (failedChecks.some((check) => rerunning.has(check.name))) {
    log('rerunning')
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
    log('no-workspace')
    return
  }
  // Why the URL: GitHub can list a failed run under the head a fix just pushed.
  const runKey = (check: TriagedCheck): string => JSON.stringify([repo.id, prNumber, check.url])
  const now = Date.now()
  const memory = readMemory(now)
  const untriaged = linked.filter((check) => memory.runs[runKey(check)] === undefined)
  const prKey = JSON.stringify([repo.id, prNumber])
  const prStarts = memory.prStarts[prKey]?.count ?? 0
  if (untriaged.length === 0) {
    log('already-triaged')
    return
  }
  // Why: each pushed fix is a new head, so a fix that keeps failing would otherwise triage forever.
  if (prStarts >= MAX_TRIAGES_PER_PR) {
    log('cap-reached', { prStarts })
    return
  }
  for (const check of untriaged) {
    memory.runs[runKey(check)] = now
  }
  memory.prStarts[prKey] = { count: prStarts + 1, at: now }
  writeMemory(memory)
  if (!(await viewerAuthoredPR(repo, prNumber, prRepo))) {
    log('not-author')
    return
  }
  // Why the unlinked ones too: the agent reads them as part of what failed, not as runs of their own.
  const runs = [...untriaged, ...failedChecks.filter((check) => !check.url)]
  const started = { runs, worktreeId: workspace.id, prStarts: prStarts + 1 }
  log('started', started)
  void startFixChecksAgent({
    repoId: repo.id,
    worktreeId: workspace.id,
    basePrompt: buildCiTriagePrompt({
      prNumber,
      headSha,
      failedChecks: runs,
      instructions: ciTriageInstructions(repo.ciTriage)
    }),
    launchSource: 'source_control_recovery',
    background: true
  }).then(
    (launched) => log(launched ? 'launched' : 'launch-failed', started),
    (error: unknown) => log('launch-failed', { ...started, error: String(error) })
  )
}
