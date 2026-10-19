import React from 'react'
import { useNow } from '@/hooks/use-now'
import { formatCheckDuration } from '../../../../shared/github/check-duration'
import type { PRCheckDetail } from '../../../../shared/github/check-types'

export function CheckRowDuration({ check }: { check: PRCheckDetail }): React.JSX.Element | null {
  const running = check.status === 'in_progress'
  const now = useNow(1000, running)
  const duration = formatCheckDuration(check, now)
  if (!duration) {
    return null
  }
  return <span className="text-[11px] tabular-nums text-muted-foreground/70">{duration}</span>
}
