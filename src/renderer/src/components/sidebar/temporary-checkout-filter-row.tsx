import { FolderClock } from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { FilterToggleRow } from './FilterToggleRow'

/** Fork: "Hide temporary checkouts", rendered after the shared filter rows. */
export function TemporaryCheckoutFilterRow(): React.JSX.Element {
  const hideTemporaryCheckoutWorkspaces = useAppStore((s) => s.hideTemporaryCheckoutWorkspaces)
  const setHideTemporaryCheckoutWorkspaces = useAppStore(
    (s) => s.setHideTemporaryCheckoutWorkspaces
  )
  return (
    <FilterToggleRow
      icon={<FolderClock className="size-3.5" />}
      label={translate(
        'auto.components.sidebar.SidebarWorkspaceFilterSection.temporaryCheckouts',
        'Hide temporary checkouts'
      )}
      checked={hideTemporaryCheckoutWorkspaces}
      onChange={setHideTemporaryCheckoutWorkspaces}
    />
  )
}
