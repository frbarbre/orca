import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerminalQuickCommandHost } from '@/hooks/use-terminal-quick-command-hosts'

export function TabBarQuickCommandHostFilter({
  hosts,
  hidden,
  onToggle
}: {
  hosts: readonly TerminalQuickCommandHost[]
  hidden: readonly string[]
  onToggle: (hostId: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border/50 px-2 py-1.5">
      {hosts.map((host) => {
        const visible = !hidden.includes(host.hostId)
        return (
          <button
            key={host.hostId}
            type="button"
            aria-pressed={visible}
            onClick={() => onToggle(host.hostId)}
            className={cn(
              'flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              visible
                ? 'border-border bg-muted text-foreground'
                : 'border-border/50 text-muted-foreground hover:text-foreground'
            )}
          >
            <Check className={cn('size-3', !visible && 'invisible')} />
            {host.label}
          </button>
        )
      })}
    </div>
  )
}
