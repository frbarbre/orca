import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type {
  WorkspaceStatusRuleCondition,
  WorkspaceStatusRuleConfig
} from '../../../../shared/workspace-status-rule-config'
import { SettingsRow, SettingsSwitchRow } from './SettingsFormControls'
import { ConditionRows, ProjectScopeRow } from './PullRequestStatusRuleRows'

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
        <>
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
          <ConditionRows config={config} statuses={statuses} onChange={setCondition} />
          <SettingsRow
            label={translate('auto.components.settings.prRules.checkName', 'Merge gate check name')}
            description={translate(
              'auto.components.settings.prRules.checkNameDescription',
              'The check that decides "Merge gate passed" above. Matches a check run or a commit status by name.'
            )}
            control={
              <Input
                value={config.mergingCheckName}
                onChange={(event) => patch({ mergingCheckName: event.target.value })}
                className="h-7 w-[220px]"
              />
            }
          />
          <SettingsRow
            label={translate('auto.components.settings.prRules.pmTeam', 'PM approval team')}
            description={translate(
              'auto.components.settings.prRules.pmTeamDescription',
              'As org/team-slug, for example flowbasedk/pm-approval. Leave empty to skip that column.'
            )}
            control={
              <Input
                value={config.pmApprovalTeam ?? ''}
                placeholder="org/team-slug"
                onChange={(event) => patch({ pmApprovalTeam: event.target.value || null })}
                className="h-7 w-[220px]"
              />
            }
          />
          <SettingsSwitchRow
            label={translate(
              'auto.components.settings.prRules.deleteOnMerge',
              'Delete the workspace when its pull request is merged or closed'
            )}
            description={translate(
              'auto.components.settings.prRules.deleteOnMergeDescription',
              'Runs your orca.yaml archive script first. A workspace with uncommitted work or a running agent is kept, and Orca says so. The branch itself stays on the remote.'
            )}
            checked={config.onResolved === 'delete'}
            onChange={() =>
              patch({ onResolved: config.onResolved === 'delete' ? 'none' : 'delete' })
            }
          />
          <SettingsSwitchRow
            label={translate(
              'auto.components.settings.prRules.deleteOnReviewed',
              'Close a review workspace once you have reviewed'
            )}
            description={translate(
              'auto.components.settings.prRules.deleteOnReviewedDescription',
              'Applies to pull requests you did not write, once you have approved or requested changes. A workspace holding unsent review comments, uncommitted work or a running agent is kept. If the author asks you again, the workspace comes back with the diff pointed at the commit you last reviewed.'
            )}
            checked={config.onReviewed === 'delete'}
            onChange={() =>
              patch({ onReviewed: config.onReviewed === 'delete' ? 'none' : 'delete' })
            }
          />
          <SettingsSwitchRow
            label={translate(
              'auto.components.settings.prRules.reviewInbox',
              'Open a workspace when you are asked to review'
            )}
            description={translate(
              'auto.components.settings.prRules.reviewInboxDescription',
              'Creates the workspace, points the diff at the pull request base, and starts the agent on the prompt below. Every review already waiting on you is picked up on the first check.'
            )}
            checked={config.reviewInbox.enabled}
            onChange={() =>
              patch({
                reviewInbox: { ...config.reviewInbox, enabled: !config.reviewInbox.enabled }
              })
            }
          />
          {config.reviewInbox.enabled ? (
            <>
              <SettingsRow
                alignTop
                label={translate(
                  'auto.components.settings.prRules.prompt',
                  'Prompt for a first review'
                )}
                description={translate(
                  'auto.components.settings.prRules.promptDescription',
                  'Supports {{prNumber}}, {{title}}, {{author}}, {{branch}}, {{baseRef}}, {{url}} and {{repo}}.'
                )}
                control={
                  <Textarea
                    value={config.reviewInbox.promptTemplate}
                    onChange={(event) =>
                      patch({
                        reviewInbox: { ...config.reviewInbox, promptTemplate: event.target.value }
                      })
                    }
                    className="h-40 w-[320px]"
                  />
                }
              />
              <SettingsRow
                alignTop
                label={translate(
                  'auto.components.settings.prRules.rereviewPrompt',
                  'Prompt when you are asked again'
                )}
                description={translate(
                  'auto.components.settings.prRules.rereviewPromptDescription',
                  'Used when a pull request you already reviewed comes back to you. Same variables, plus {{sinceCommit}} — the commit you last reviewed, which the diff is pointed at.'
                )}
                control={
                  <Textarea
                    value={config.reviewInbox.rereviewPromptTemplate}
                    onChange={(event) =>
                      patch({
                        reviewInbox: {
                          ...config.reviewInbox,
                          rereviewPromptTemplate: event.target.value
                        }
                      })
                    }
                    className="h-40 w-[320px]"
                  />
                }
              />
            </>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
