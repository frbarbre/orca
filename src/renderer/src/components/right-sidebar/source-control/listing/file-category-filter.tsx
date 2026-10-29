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
import { isSourceControlFileArea, type SourceControlFileFilterKey } from './file-category'

// Why per group: a hidden area says nothing about file types, so each group names only its own.
function shownLabel(
  present: readonly SourceControlFileFilterKey[],
  hidden: ReadonlySet<SourceControlFileFilterKey>,
  none: string
): string | null {
  if (!present.some((key) => hidden.has(key))) {
    return null
  }
  const shown = present.filter((key) => !hidden.has(key))
  return shown.length === 0 ? none : shown.map(getFileCategoryLabel).join(', ')
}

function getFileCategoryLabel(category: SourceControlFileFilterKey): string {
  switch (category) {
    case 'lint-baseline':
      return translate(
        'auto.components.right.sidebar.SourceControl.fileCategory.lintBaseline',
        'Lint baselines'
      )
    case 'backend':
      return translate('auto.components.right.sidebar.SourceControl.fileArea.backend', 'Backend')
    case 'frontend':
      return translate('auto.components.right.sidebar.SourceControl.fileArea.frontend', 'Frontend')
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
  presentFileCategories: readonly SourceControlFileFilterKey[],
  isCategoryFilterActive: boolean
): boolean {
  return presentFileCategories.length > 1 || isCategoryFilterActive
}

export function SourceControlFileCategoryFilter({
  presentFileCategories,
  hiddenFileCategories,
  isCategoryFilterActive,
  onToggleFileCategory,
  compact = false
}: {
  presentFileCategories: readonly SourceControlFileFilterKey[]
  hiddenFileCategories: ReadonlySet<SourceControlFileFilterKey>
  isCategoryFilterActive: boolean
  onToggleFileCategory: (category: SourceControlFileFilterKey) => void
  /** An icon button for a section header instead of the full-width row. */
  compact?: boolean
}): React.JSX.Element {
  const presentTypes = presentFileCategories.filter((key) => !isSourceControlFileArea(key))
  const presentAreas = presentFileCategories.filter(isSourceControlFileArea)
  const triggerLabel = !isCategoryFilterActive
    ? translate(
        'auto.components.right.sidebar.SourceControl.fileCategory.allTypes',
        'All file types'
      )
    : [
        shownLabel(
          presentTypes,
          hiddenFileCategories,
          translate(
            'auto.components.right.sidebar.SourceControl.fileCategory.noTypes',
            'No file types'
          )
        ),
        shownLabel(
          presentAreas,
          hiddenFileCategories,
          translate('auto.components.right.sidebar.SourceControl.fileArea.none', 'No areas')
        )
      ]
        .filter(Boolean)
        .join(' · ')
  const checkbox = (category: SourceControlFileFilterKey): React.JSX.Element => (
    <DropdownMenuCheckboxItem
      key={category}
      checked={!hiddenFileCategories.has(category)}
      onCheckedChange={() => onToggleFileCategory(category)}
      // Why: keep the menu open so several types can be toggled in one visit.
      onSelect={(event) => event.preventDefault()}
    >
      {getFileCategoryLabel(category)}
    </DropdownMenuCheckboxItem>
  )

  const ariaLabel = translate(
    'auto.components.right.sidebar.SourceControl.fileCategory.triggerLabel',
    'Filter changed files by type'
  )
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact && isCategoryFilterActive ? (
          <button
            type="button"
            title={triggerLabel}
            aria-label={ariaLabel}
            data-filter-active="true"
            className="flex h-5 min-w-0 items-center gap-1 rounded-full border border-border bg-muted px-2 text-[11px] text-foreground hover:bg-accent"
            onClick={(event) => event.stopPropagation()}
          >
            <ListFilter className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{triggerLabel}</span>
          </button>
        ) : compact ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={triggerLabel}
            aria-label={ariaLabel}
            className="text-muted-foreground hover:text-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <ListFilter className="size-3.5" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="w-full justify-start"
            aria-label={ariaLabel}
          >
            <ListFilter className="size-3.5" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={compact ? 'end' : 'start'}
        className={compact ? 'w-48' : 'w-(--radix-dropdown-menu-trigger-width)'}
      >
        <DropdownMenuLabel>
          {translate(
            'auto.components.right.sidebar.SourceControl.fileCategory.menuLabel',
            'Show file types'
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {presentTypes.map(checkbox)}
        {presentAreas.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {translate(
                'auto.components.right.sidebar.SourceControl.fileArea.menuLabel',
                'Show areas'
              )}
            </DropdownMenuLabel>
            {presentAreas.map(checkbox)}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
  return compact ? menu : <div className="px-3 pb-2">{menu}</div>
}
