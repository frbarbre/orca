import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type {
  WorkspaceStatusRuleCondition,
  WorkspaceStatusRuleConfig
} from '../../../../shared/workspace-status-rule-config'
import { SettingsSwitchRow } from './SettingsFormControls'
import { WorkspaceActionPromptsSection } from './WorkspaceActionPromptsSection'
import { PullRequestStatusRuleTabs } from './PullRequestStatusRuleTabs'

export function PullRequestStatusRulesSection(): React.JSX.Element {
  const config = useAppStore((state) => state.workspaceStatusRules)
  const statuses = useAppStore((state) => state.workspaceStatuses)
  const repos = useAppStore((state) => state.repos)
  const setWorkspaceStatusRules = useAppStore((state) => state.setWorkspaceStatusRules)

  const patch = (updates: Partial<WorkspaceStatusRuleConfig>): void => {
    setWorkspaceStatusRules({ ...config, ...updates })
  }
  const setCondition = (
    condition: WorkspaceStatusRuleCondition,
    status: string | undefined
  ): void => {
    const next = { ...config.statusByCondition }
    if (status) {
      next[condition] = status
    } else {
      delete next[condition]
    }
    patch({ statusByCondition: next })
  }

  return (
    <section className="divide-y divide-border">
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.prRules.enable',
          'Move workspaces by pull request state'
        )}
        description={translate(
          'auto.components.settings.prRules.enableDescription',
          'Checks the linked pull request every minute while Orca is open, and sets the board column to match.'
        )}
        checked={config.enabled}
        onChange={() => patch({ enabled: !config.enabled })}
      />
      {config.enabled ? (
        <PullRequestStatusRuleTabs
          config={config}
          statuses={statuses}
          repos={repos}
          patch={patch}
          setCondition={setCondition}
        />
      ) : (
        <WorkspaceActionPromptsSection />
      )}
    </section>
  )
}
