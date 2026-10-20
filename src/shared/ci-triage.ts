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
    'Read the failed jobs and their logs (`gh run view <run id> --log-failed`), then for each error decide which case it is:',
    '',
    '1. Noise a rerun would pass: a test that already fails or flakes on main (check with the Sentry MCP and the hints below), or an infrastructure problem such as a lost runner, a network error, a registry or rate-limit timeout. If the run is on its first attempt (`gh api repos/{owner}/{repo}/actions/runs/<run id> --jq .run_attempt` prints 1), rerun its failed jobs once with `gh run rerun <run id> --failed`. Never rerun a run past its first attempt.',
    '2. The branch is behind main: it breaks on something main has already changed or fixed. Run `git fetch origin && git merge origin/main`, resolve any conflicts, and fix what the merge breaks.',
    '3. A clear fix: lint, format, type errors, or another failure whose cause and fix are plain from the error. Fix it.',
    '4. Anything else, such as a failing assertion whose right behaviour is unclear: leave it red.',
    '',
    'For cases 2 and 3, change only what the errors need, run the failing check locally when it is quick, then commit and `git push`. Never force-push or rewrite history.',
    '',
    'Finish with one line: "Reran: <why>", "Fixed: <what>", or "Left red: <why>".'
  ]
  if (hints) {
    lines.push('', 'About this repository:', hints)
  }
  return lines.join('\n')
}
