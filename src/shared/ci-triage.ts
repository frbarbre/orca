import type { PRCheckDetail } from './github/check-types'

/** Fork: a repo with this set gets an agent to triage each failed CI run of a workspace PR. */
export type CiTriageConfig = {
  /** What the agent is told to do; the default when left out, so it keeps getting improvements. */
  prompt?: string
  /** Saved before the prompt was editable; read as the default prompt with these appended. */
  hints?: string
}

export type TriagedCheck = { name: string; url: string | null }

const FAILED = new Set(['failure', 'timed_out'])

export const DEFAULT_CI_TRIAGE_INSTRUCTIONS = [
  'Read the failed jobs and their logs (`gh run view <run id> --log-failed`), then for each error decide which case it is:',
  '',
  '1. Noise a rerun would pass: a test that already fails or flakes on main (check with the Sentry MCP), or an infrastructure problem such as a lost runner, a network error, a registry or rate-limit timeout. If the run is on its first attempt (`gh api repos/{owner}/{repo}/actions/runs/<run id> --jq .run_attempt` prints 1), rerun its failed jobs once with `gh run rerun <run id> --failed`. Never rerun a run past its first attempt.',
  '2. The branch is behind main: it breaks on something main has already changed or fixed. Run `git fetch origin && git merge origin/main`, resolve any conflicts, and fix what the merge breaks.',
  '3. A clear fix: lint, format, type errors, or another failure whose cause and fix are plain from the error. Fix it.',
  '4. Tests: a test the change broke. Read the PR description and diff (`gh pr view <number>`, `git diff origin/main...HEAD`) to learn what the change intends. If the test asserts behaviour the PR deliberately changed, update the test to the new behaviour; if the implementation clearly misses what the PR intends, fix the implementation. Fix it only when which side is right is clear.',
  '5. Anything else, such as a failing test where it is unclear whether the test or the change is wrong: leave it red.',
  '',
  'For cases 2, 3 and 4, change only what the errors need, run the failing check locally when it is quick, then commit and `git push`. Never force-push or rewrite history.',
  '',
  'Finish with one line: "Reran: <why>", "Fixed: <what>", or "Left red: <why>".'
].join('\n')

export function ciTriageInstructions(config: CiTriageConfig): string {
  if (config.prompt) {
    return config.prompt
  }
  const hints = config.hints?.trim()
  return hints
    ? `${DEFAULT_CI_TRIAGE_INSTRUCTIONS}\n\nAbout this repository:\n${hints}`
    : DEFAULT_CI_TRIAGE_INSTRUCTIONS
}

export function parseCiTriageConfig(value: unknown): CiTriageConfig | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const { prompt, hints } = value as { prompt?: unknown; hints?: unknown }
  const instructions = ciTriageInstructions({
    prompt: typeof prompt === 'string' ? prompt.trim() : undefined,
    hints: typeof hints === 'string' ? hints : undefined
  })
  return instructions === DEFAULT_CI_TRIAGE_INSTRUCTIONS ? {} : { prompt: instructions }
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
  instructions
}: {
  prNumber: number
  headSha: string | undefined
  failedChecks: readonly TriagedCheck[]
  instructions: string
}): string {
  const checks = failedChecks
    .map((check) => `- ${check.name}${check.url ? `: ${check.url}` : ''}`)
    .join('\n')
  return [
    `CI failed on pull request #${prNumber}${headSha ? ` at ${headSha}` : ''}. Failed checks:`,
    checks,
    '',
    instructions
  ].join('\n')
}
