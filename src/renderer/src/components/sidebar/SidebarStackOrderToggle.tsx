import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import type { StackOrder } from '../../../../shared/sidebar-list/stack-groups'

type SidebarStackOrderToggleProps = {
  stackOrder: StackOrder
  setStackOrder: (order: StackOrder) => void
}

const OPTIONS = [
  {
    id: 'desc',
    Icon: ArrowDownWideNarrow,
    label: () => translate('auto.components.sidebar.SidebarStackOrderToggle.desc', 'Desc'),
    title: () =>
      translate(
        'auto.components.sidebar.SidebarStackOrderToggle.descTitle',
        'List each stack from the PR furthest from main down'
      )
  },
  {
    id: 'asc',
    Icon: ArrowUpNarrowWide,
    label: () => translate('auto.components.sidebar.SidebarStackOrderToggle.asc', 'Asc'),
    title: () =>
      translate(
        'auto.components.sidebar.SidebarStackOrderToggle.ascTitle',
        'List each stack from the PR on main up'
      )
  }
] as const

export function SidebarStackOrderToggle({
  stackOrder,
  setStackOrder
}: SidebarStackOrderToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={stackOrder}
      onValueChange={(value) => {
        if (value) {
          setStackOrder(value as StackOrder)
        }
      }}
      variant="outline"
      size="sm"
      className="h-6 w-full justify-stretch"
    >
      {OPTIONS.map(({ id, Icon, label, title }) => (
        <ToggleGroupItem
          key={id}
          value={id}
          title={title()}
          // Same as the Group by toggle: Radix roving focus can swallow the click.
          onPointerDownCapture={() => setStackOrder(id)}
          className="h-6 grow basis-0 gap-1 px-1 text-[10px] data-[state=on]:bg-foreground/10 data-[state=on]:font-semibold data-[state=on]:text-foreground"
        >
          <Icon className="size-3" />
          {label()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
