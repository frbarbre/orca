import React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'

export function SectionHeader({
  label,
  count,
  countTitle,
  conflictCount = 0,
  isCollapsed,
  onToggle,
  actions,
  className
}: {
  label: string
  count: number
  /** Spells out what the count measures — e.g. files changed against a compare base. */
  countTitle?: string
  conflictCount?: number
  isCollapsed: boolean
  onToggle: () => void
  actions?: React.ReactNode
  /** Overrides the outer spacing for a section that sits in a differently padded shelf. */
  className?: string
}): React.JSX.Element {
  // Fork: the Commits header's row, sticky so a long section keeps its title and actions in view.
  return (
    <div
      className={cn(
        'sticky top-0 z-[2] h-7 shrink-0 border-t border-border bg-sidebar pl-1 pr-3',
        className
      )}
    >
      <div className="group/section flex h-full items-stretch rounded-md pr-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 px-0.5 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/70 outline-none hover:text-foreground focus-visible:text-foreground"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
        >
          <ChevronDown
            className={cn('size-3 shrink-0 transition-transform', isCollapsed && '-rotate-90')}
          />
          <span className="min-w-0 truncate" title={label}>
            {label}
          </span>
          {/* Why: no aria-label here — inside the toggle button it would rewrite the
              button's accessible name; the explanation stays a hover-only title. */}
          <span className="shrink-0 text-[10px] font-medium tabular-nums" title={countTitle}>
            {count}
          </span>
          {conflictCount > 0 && (
            <span className="min-w-0 truncate text-[10px] font-medium normal-case tracking-normal text-destructive/80">
              {conflictCount}{' '}
              {translate('auto.components.right.sidebar.SourceControl.413a3ba113', 'conflict')}
              {conflictCount === 1 ? '' : 's'}
            </span>
          )}
        </button>
        <div className="ml-auto flex shrink-0 items-center justify-end">{actions}</div>
      </div>
    </div>
  )
}
