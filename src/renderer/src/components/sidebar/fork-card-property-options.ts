import { translate } from '@/i18n/i18n'
import type { WorktreeCardProperty } from '../../../../shared/ui-chrome-types'

type CardDisplayOption = { id: WorktreeCardProperty; readonly label: string }

const FORK_CARD_DISPLAY_OPTIONS: { after: WorktreeCardProperty; option: CardDisplayOption }[] = [
  {
    after: 'linear-issue',
    option: {
      id: 'linear-title',
      get label() {
        return translate(
          'auto.components.sidebar.SidebarWorkspaceOptionsMenu.linearTitle',
          'Linear title'
        )
      }
    }
  },
  {
    after: 'jira-issue',
    option: {
      id: 'pr-author',
      get label() {
        return translate(
          'auto.components.sidebar.SidebarWorkspaceOptionsMenu.prAuthor',
          'PR author'
        )
      }
    }
  },
  {
    after: 'jira-issue',
    option: {
      id: 'stack',
      get label() {
        return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.stack', 'Stack')
      }
    }
  }
]

/** Fork: slots the fork's card properties in after the upstream row they extend. */
export function withForkCardDisplayOptions(options: CardDisplayOption[]): CardDisplayOption[] {
  return options.flatMap((option) => [
    option,
    ...FORK_CARD_DISPLAY_OPTIONS.filter((fork) => fork.after === option.id).map(
      (fork) => fork.option
    )
  ])
}
