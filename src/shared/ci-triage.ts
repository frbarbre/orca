import type { PRCheckDetail } from './github/check-types'

/** Fork: a repo with this set gets an agent to triage each failed CI run of a workspace PR. */
export type CiTriageConfig = {
  /** What the agent should know about this repo's CI, e.g. where its Sentry is. */
  hints: string
}

export type TriagedCheck = { name: string; url: string | null }

const FAILED = new Set(['failure', 'timed_out'])

export function parseCiTriageConfig(value: unknown): CiTriageConfig | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const hints = (value as { hints?: unknown }).hints
  return { hints: typeof hints === 'string' ? hints.trim() : '' }
}

export function failedChecksToTriage(checks: readonly PRCheckDetail[]): TriagedCheck[] {
  return checks
    .filter((check) => check.status === 'completed' && FAILED.has(check.conclusion ?? ''))
    .map((check) => ({ name: check.name, url: check.url }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function buildCiTriagePrompt({
  prNumber,
  headSha,
  failedChecks,
  hints
}: {
  prNumber: number
  headSha: string | undefined
  failedChecks: readonly TriagedCheck[]
  hints: string
}): string {
  const checks = failedChecks
    .map((check) => `- ${check.name}${check.url ? `: ${check.url}` : ''}`)
    .join('\n')
  const lines = [
    `CI failed on pull request #${prNumber}${headSha ? ` at ${headSha}` : ''}. Failed checks:`,
    checks,
    '',
    'Decide whether this failure was caused by the change, or is noise worth one rerun: a test that already fails or flakes on main, or an infrastructure problem such as a lost runner, a network error, a registry or rate-limit timeout.',
    '',
    '1. Read the failed jobs and their logs (`gh run view <run id> --log-failed`).',
    '2. For each failing test, check whether main already fails or flakes on it, using the Sentry MCP and the hints below when there are any.',
    '3. If every failure is noise, and the run is on its first attempt (`gh api repos/{owner}/{repo}/actions/runs/<run id> --jq .run_attempt` prints 1), rerun its failed jobs once with `gh run rerun <run id> --failed`. Never rerun a run past its first attempt.',
    '4. Otherwise leave it red.',
    '',
    'Do not change any code, commit, or push. Finish with one line: "Reran: <why>" or "Left red: <why>".'
  ]
  if (hints) {
    lines.push('', 'About this repository:', hints)
  }
  return lines.join('\n')
}
