import React from 'react'
import { cn } from '@/lib/utils'

export type SegmentedTabOption<Id extends string> = {
  id: Id
  label: string
  Icon?: React.ComponentType<{ className?: string }>
  /** Present when the option cannot be chosen; shown on hover and blocks the click. */
  disabledReason?: string
}

/**
 * The small icon-and-label switch used where a surface has two or three modes.
 *
 * Why shared: it started in the line-comment popover and the review panel wanted the same
 * control, and a second copy would have drifted the moment either was restyled.
 */
export function SegmentedTabs<Id extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth,
  className
}: {
  options: readonly SegmentedTabOption<Id>[]
  value: Id
  onChange: (id: Id) => void
  ariaLabel?: string
  /** Stretches the options to share the row evenly, for a control that owns its container. */
  fullWidth?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5',
        fullWidth && 'w-full',
        className
      )}
    >
      {options.map(({ id, label, Icon, disabledReason }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={Boolean(disabledReason)}
            title={disabledReason}
            onClick={() => onChange(id)}
            className={cn(
              'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors',
              fullWidth && 'flex-1 justify-center',
              active
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
              disabledReason && 'cursor-not-allowed opacity-40 hover:text-muted-foreground'
            )}
          >
            {Icon ? <Icon className="size-3" /> : null}
            {label}
          </button>
        )
      })}
    </div>
  )
}
