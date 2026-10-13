import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'
import type { WorkspaceStatusDefinition } from '../../../../shared/worktree/types'
import {
  WORKSPACE_STATUS_RULE_CONDITIONS,
  type WorkspaceStatusRuleCondition,
  type WorkspaceStatusRuleConfig
} from '../../../../shared/workspace-status-rule-config'
import { ConditionRow, NewWorkspaceStatusRow, ProjectScopeRow } from './PullRequestStatusRuleRows'
import { ConditionSettings } from './PullRequestStatusRuleStateSettings'
import { getPullRequestStatusRuleTabLabels } from './pull-request-status-rule-copy'
import { WorkspaceActionPromptsSection } from './WorkspaceActionPromptsSection'

const TRIGGER_CLASS = 'flex-none text-xs'

// Fork: one tab per pull request state, so a state's column and what happens there sit together.
export function PullRequestStatusRuleTabs({
  config,
  statuses,
  repos,
  patch,
  setCondition
}: {
  config: WorkspaceStatusRuleConfig
  statuses: readonly WorkspaceStatusDefinition[]
  repos: readonly Repo[]
  patch: (updates: Partial<WorkspaceStatusRuleConfig>) => void
  setCondition: (condition: WorkspaceStatusRuleCondition, status: string | undefined) => void
}): React.JSX.Element {
  const tabLabels = getPullRequestStatusRuleTabLabels()
  return (
    <Tabs defaultValue="general" className="py-3">
      <TabsList
        variant="line"
        className="w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto"
      >
        <TabsTrigger value="general" className={TRIGGER_CLASS}>
          {translate('auto.components.settings.prRules.tabGeneral', 'General')}
        </TabsTrigger>
        {WORKSPACE_STATUS_RULE_CONDITIONS.map((condition) => (
          <TabsTrigger key={condition} value={condition} className={TRIGGER_CLASS}>
            {tabLabels[condition]}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="general" className="divide-y divide-border">
        <ProjectScopeRow
          repos={repos}
          repoIds={config.repoIds}
          onToggle={(repoId, selected) =>
            patch({
              repoIds: selected
                ? [...config.repoIds, repoId]
                : config.repoIds.filter((id) => id !== repoId)
            })
          }
        />
        <NewWorkspaceStatusRow
          value={config.newWorkspaceStatus}
          statuses={statuses}
          onChange={(status) =>
            patch({
              newWorkspaceStatus: status ?? null,
              newWorkspaceStatusSince: status ? Date.now() : null
            })
          }
        />
        <WorkspaceActionPromptsSection />
      </TabsContent>
      {WORKSPACE_STATUS_RULE_CONDITIONS.map((condition) => (
        <TabsContent key={condition} value={condition} className="divide-y divide-border">
          <ConditionRow
            condition={condition}
            config={config}
            statuses={statuses}
            onChange={setCondition}
          />
          <ConditionSettings condition={condition} config={config} patch={patch} />
        </TabsContent>
      ))}
    </Tabs>
  )
}
