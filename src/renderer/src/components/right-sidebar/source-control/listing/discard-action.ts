import { Trash, Undo2, type LucideIcon } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'

/** What discarding an entry does, as its button and menu item name it. */
export function discardAction(entry: GitStatusEntry): { icon: LucideIcon; label: string } {
  if (entry.area === 'untracked') {
    return {
      icon: Trash,
      label: translate(
        'auto.components.right.sidebar.SourceControl.11463f7a98',
        'Delete untracked file'
      )
    }
  }
  return {
    icon: Undo2,
    label:
      entry.status === 'deleted'
        ? translate('auto.components.right.sidebar.SourceControl.989f3d5e34', 'Restore file')
        : translate('auto.components.right.sidebar.SourceControl.d54dd48b0b', 'Discard changes')
  }
}
