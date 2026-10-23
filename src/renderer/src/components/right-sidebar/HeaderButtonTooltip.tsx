import React from 'react'
import { useAppStore } from '@/store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatOptionalPrimaryShortcutLabel } from '@/hooks/useShortcutLabel'
import type { KeybindingActionId } from '../../../../shared/keybindings/types'

export function HeaderButtonTooltip({
  label,
  shortcut,
  children
}: {
  label: string
  shortcut?: KeybindingActionId
  children: React.ReactElement
}): React.JSX.Element {
  const keybindings = useAppStore((s) => s.keybindings)
  const shortcutLabel = shortcut ? formatOptionalPrimaryShortcutLabel(shortcut, keybindings) : null
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
        {shortcutLabel ? <span className="ml-1.5 text-background/60">{shortcutLabel}</span> : null}
      </TooltipContent>
    </Tooltip>
  )
}
