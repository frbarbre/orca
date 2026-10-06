import React from 'react'
import { ChevronDown, ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { SourceControlFileCategory } from './file-category'

function getFileCategoryLabel(category: SourceControlFileCategory): string {
  switch (category) {
    case 'implementation':
      return translate(
        'auto.components.right.sidebar.SourceControl.fileCategory.implementation',
        'Implementation'
      )
    case 'test':
      return translate('auto.components.right.sidebar.SourceControl.fileCategory.test', 'Tests')
    case 'documentation':
      return translate(
        'auto.components.right.sidebar.SourceControl.fileCategory.documentation',
        'Documentation'
      )
    case 'generated':
      return translate(
        'auto.components.right.sidebar.SourceControl.fileCategory.generated',
        'Generated'
      )
    case 'agent-guidance':
      return translate(
        'auto.components.right.sidebar.SourceControl.fileCategory.agentGuidance',
        'Agent guidance'
      )
    case 'localization':
      return translate(
        'auto.components.right.sidebar.SourceControl.fileCategory.localization',
        'Localization'
      )
    case 'assets':
      return translate('auto.components.right.sidebar.SourceControl.fileCategory.assets', 'Assets')
  }
}

export function shouldShowSourceControlFileCategoryFilter(
  presentFileCategories: readonly SourceControlFileCategory[],
  isCategoryFilterActive: boolean
): boolean {
  return presentFileCategories.length > 1 || isCategoryFilterActive
}

export function SourceControlFileCategoryFilter({
  presentFileCategories,
  hiddenFileCategories,
  isCategoryFilterActive,
  onToggleFileCategory
}: {
  presentFileCategories: readonly SourceControlFileCategory[]
  hiddenFileCategories: ReadonlySet<SourceControlFileCategory>
  isCategoryFilterActive: boolean
  onToggleFileCategory: (category: SourceControlFileCategory) => void
}): React.JSX.Element {
  const shownCategories = presentFileCategories.filter(
    (category) => !hiddenFileCategories.has(category)
  )
  const triggerLabel = !isCategoryFilterActive
    ? translate(
        'auto.components.right.sidebar.SourceControl.fileCategory.allTypes',
        'All file types'
      )
    : shownCategories.length === 0
      ? translate(
          'auto.components.right.sidebar.SourceControl.fileCategory.noTypes',
          'No file types'
        )
      : shownCategories.map(getFileCategoryLabel).join(', ')

  return (
    <div className="px-3 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="w-full justify-start"
            aria-label={translate(
              'auto.components.right.sidebar.SourceControl.fileCategory.triggerLabel',
              'Filter changed files by type'
            )}
          >
            <ListFilter className="size-3.5" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
          <DropdownMenuLabel>
            {translate(
              'auto.components.right.sidebar.SourceControl.fileCategory.menuLabel',
              'Show file types'
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {presentFileCategories.map((category) => (
            <DropdownMenuCheckboxItem
              key={category}
              checked={!hiddenFileCategories.has(category)}
              onCheckedChange={() => onToggleFileCategory(category)}
              // Why: keep the menu open so several types can be toggled in one visit.
              onSelect={(event) => event.preventDefault()}
            >
              {getFileCategoryLabel(category)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
