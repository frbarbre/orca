import type { PRCheckDetail } from './check-types'

/** How long a check ran, or has been running so far; null when that is not known. */
export function formatCheckDuration(
  check: Pick<PRCheckDetail, 'status' | 'startedAt' | 'completedAt'>,
  now: number
): string | null {
  if (check.status === 'queued' || !check.startedAt) {
    return null
  }
  const started = Date.parse(check.startedAt)
  const ended =
    check.status === 'completed'
      ? check.completedAt
        ? Date.parse(check.completedAt)
        : Number.NaN
      : now
  if (!Number.isFinite(started) || !Number.isFinite(ended)) {
    return null
  }
  const seconds = Math.max(0, Math.floor((ended - started) / 1000))
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
