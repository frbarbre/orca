import { classifyCheckOutcome, summarizeProviderChecks } from './provider-check-summary'
import type { PRCheckDetail } from './github/check-types'
import type { CardCheckStatus, CheckStatus } from './github/pull-request-types'

export function derivePRCheckStatus(checks: readonly PRCheckDetail[]): CheckStatus {
  const { state } = summarizeProviderChecks(checks)
  // Why: CheckStatus has no 'none'; an empty rollup carries the same "nothing to report" meaning.
  return state === 'none' ? 'neutral' : state
}

type RawCheckRollup = { status?: unknown; conclusion?: unknown; state?: unknown }

function normalizeRollupCheck(raw: RawCheckRollup, index: number): PRCheckDetail {
  const status = String(raw.status ?? '').toLowerCase()
  const state = String(raw.state ?? '').toLowerCase()
  const conclusion = String(raw.conclusion ?? '').toLowerCase()
  const normalizedConclusion =
    conclusion === 'error' || conclusion === 'startup_failure'
      ? 'failure'
      : conclusion ||
        (state === 'failure' || state === 'error'
          ? 'failure'
          : state === 'success'
            ? 'success'
            : '')
  const isPending =
    status === 'queued' ||
    status === 'in_progress' ||
    status === 'pending' ||
    state === 'pending' ||
    conclusion === 'pending'

  return {
    name: `check-${index}`,
    status: isPending ? (status === 'in_progress' ? 'in_progress' : 'queued') : 'completed',
    conclusion: (isPending
      ? 'pending'
      : normalizedConclusion || null) as PRCheckDetail['conclusion'],
    url: null
  }
}

export function derivePRCheckStatusFromRollup(rollup: unknown): CheckStatus {
  if (!Array.isArray(rollup) || rollup.length === 0) {
    return 'neutral'
  }
  return derivePRCheckStatus(
    rollup.map((raw, index) =>
      normalizeRollupCheck(raw && typeof raw === 'object' ? (raw as RawCheckRollup) : {}, index)
    )
  )
}

/** Fork: {@link deriveCardCheckStatusFromRollup} for a fetched check list. */
export function deriveCardCheckStatus(checks: readonly PRCheckDetail[]): CardCheckStatus {
  if (checks.some((check) => check.status === 'in_progress')) {
    return 'running'
  }
  const outcomes = checks
    .filter((check) => check.status === 'completed')
    .map((check) => classifyCheckOutcome(check))
  return outcomes.includes('failed')
    ? 'failure'
    : outcomes.includes('passed')
      ? 'success'
      : 'neutral'
}

/**
 * Fork: the sidebar card's read — a running check shows as running even beside a failed one,
 * and a queued check counts for nothing, so a failure only shows once nothing is still running.
 * Why a pending commit status counts as queued: it has no running state, and a status such as
 * "Reviews satisfied" stays pending for hours, as the checks panel shows it.
 */
export function deriveCardCheckStatusFromRollup(rollup: unknown): CardCheckStatus {
  if (!Array.isArray(rollup)) {
    return 'neutral'
  }
  let failed = false
  let passed = false
  for (const [index, entry] of rollup.entries()) {
    const raw: RawCheckRollup = entry && typeof entry === 'object' ? entry : {}
    const status = String(raw.status ?? '').toLowerCase()
    if (status === 'in_progress') {
      return 'running'
    }
    const check = normalizeRollupCheck(raw, index)
    if (check.status !== 'completed') {
      continue
    }
    const outcome = classifyCheckOutcome(check)
    failed ||= outcome === 'failed'
    passed ||= outcome === 'passed'
  }
  return failed ? 'failure' : passed ? 'success' : 'neutral'
}
