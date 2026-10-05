import { translate } from '@/i18n/i18n'
import type { WorktreeCardPropertyOption } from './sidebar-workspace-option-items'

export const LINEAR_TITLE_CARD_PROPERTY_OPTION: WorktreeCardPropertyOption = {
  id: 'linear-title',
  properties: ['linear-title'],
  get label() {
    return translate(
      'auto.components.sidebar.SidebarWorkspaceOptionsMenu.linearTitle',
      'Linear title'
    )
  }
}

export const PR_AUTHOR_CARD_PROPERTY_OPTION: WorktreeCardPropertyOption = {
  id: 'pr-author',
  properties: ['pr-author'],
  get label() {
    return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.prAuthor', 'PR author')
  }
}
