import type { AriaAttributes, ComponentType } from 'react'
import { Badge } from '@/components/ui/badge'

/** The inline chip an atomic prompt node renders as: a skill, or a referenced file. */
export function NativeChatPromptPill({
  icon: Icon,
  label,
  selected,
  ...badgeProps
}: {
  // Fork: also a Material Icon Theme file icon, which is an <img>, not an svg.
  icon: ComponentType<{ className?: string; 'aria-hidden'?: AriaAttributes['aria-hidden'] }>
  label: string
  selected: boolean
  title?: string
}): React.JSX.Element {
  return (
    <Badge variant="promptPill" data-selected={selected} {...badgeProps}>
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </Badge>
  )
}
