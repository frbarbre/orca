import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { useSidebarHostScopeOptions } from '../sidebar/use-sidebar-host-scope-options'
import { SettingsRow } from './SettingsFormControls'

const UNMAPPED = '__none__'

export function RemoteHostStatusRulesSection(): React.JSX.Element | null {
  const config = useAppStore((state) => state.workspaceStatusRules)
  const statuses = useAppStore((state) => state.workspaceStatuses)
  const setWorkspaceStatusRules = useAppStore((state) => state.setWorkspaceStatusRules)
  const { hostOptions } = useSidebarHostScopeOptions()
  const remoteHosts = hostOptions.filter((host) => host.kind !== 'local')

  if (remoteHosts.length === 0) {
    return null
  }

  const setHostStatus = (hostId: string, status: string | undefined): void => {
    const next = { ...config.statusByHost }
    if (status) {
      next[hostId] = status
    } else {
      delete next[hostId]
    }
    setWorkspaceStatusRules({ ...config, statusByHost: next })
  }

  return (
    <section className="divide-y divide-border">
      <div className="space-y-1 py-4">
        <h3 className="text-sm font-medium">
          {translate('auto.components.settings.hostRules.title', 'Move workspaces by server')}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {translate(
            'auto.components.settings.hostRules.description',
            'Keeps every workspace on a server in one column, checked every minute while Orca is open. It takes precedence over the pull request rules for those workspaces.'
          )}
        </p>
      </div>
      {remoteHosts.map((host) => (
        <SettingsRow
          key={host.id}
          label={host.label}
          description={host.detail}
          control={
            <Select
              value={config.statusByHost[host.id] ?? UNMAPPED}
              onValueChange={(value) =>
                setHostStatus(host.id, value === UNMAPPED ? undefined : value)
              }
            >
              <SelectTrigger size="sm" className="h-7 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNMAPPED}>
                  {translate('auto.components.settings.prRules.noColumn', 'Do nothing')}
                </SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      ))}
    </section>
  )
}
