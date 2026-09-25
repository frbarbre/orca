import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'
import type { WorkspaceStatusDefinition } from '../../../../shared/worktree/types'
import {
  WORKSPACE_STATUS_RULE_CONDITIONS,
  type WorkspaceStatusRuleCondition,
  type WorkspaceStatusRuleConfig
} from '../../../../shared/workspace-status-rule-config'
import { SettingsRow } from './SettingsFormControls'
import { getPullRequestStatusRuleCopy } from './pull-request-status-rule-copy'

const UNMAPPED = '__none__'

export function ProjectScopeRow({
  repos,
  repoIds,
  onToggle
}: {
  repos: readonly Repo[]
  repoIds: readonly string[]
  onToggle: (repoId: string, selected: boolean) => void
}): React.JSX.Element {
  return (
    <SettingsRow
      alignTop
      label={translate('auto.components.settings.prRules.projects', 'Projects')}
      description={translate(
        'auto.components.settings.prRules.projectsDescription',
        'The rules only touch workspaces in these projects, and only look for review requests there.'
      )}
      control={
        <div className="scrollbar-sleek flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
          {repos.map((repo) => (
            <div key={repo.id} className="flex items-center gap-2">
              <Checkbox
                id={`pr-rule-repo-${repo.id}`}
                checked={repoIds.includes(repo.id)}
                onCheckedChange={(checked) => onToggle(repo.id, checked === true)}
              />
              <Label htmlFor={`pr-rule-repo-${repo.id}`}>{repo.displayName}</Label>
            </div>
          ))}
        </div>
      }
    />
  )
}

export function ConditionRows({
  config,
  statuses,
  onChange
}: {
  config: WorkspaceStatusRuleConfig
  statuses: readonly WorkspaceStatusDefinition[]
  onChange: (condition: WorkspaceStatusRuleCondition, status: string | undefined) => void
}): React.JSX.Element {
  const copy = getPullRequestStatusRuleCopy()
  return (
    <>
      {WORKSPACE_STATUS_RULE_CONDITIONS.map((condition) => (
        <SettingsRow
          key={condition}
          label={copy[condition].label}
          description={copy[condition].description}
          control={
            <Select
              value={config.statusByCondition[condition] ?? UNMAPPED}
              onValueChange={(value) => onChange(condition, value === UNMAPPED ? undefined : value)}
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
    </>
  )
}
