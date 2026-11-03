import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_CONFLICT_PROMPT_TEMPLATE } from '../../../../shared/workspace-status-rule-conflict-prompt'
import { translate } from '@/i18n/i18n'
import type {
  WorkspaceStatusRuleCondition,
  WorkspaceStatusRuleConfig
} from '../../../../shared/workspace-status-rule-config'
import { SettingsRow, SettingsSwitchRow } from './SettingsFormControls'
import { ReviewingRuleSettings } from './ReviewingRuleSettings'

type StateSettingsProps = {
  config: WorkspaceStatusRuleConfig
  patch: (updates: Partial<WorkspaceStatusRuleConfig>) => void
}

function DeleteOnResolvedRow({ config, patch }: StateSettingsProps): React.JSX.Element {
  return (
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
      onChange={() => patch({ onResolved: config.onResolved === 'delete' ? 'none' : 'delete' })}
    />
  )
}

function ConflictAgentSettings({ config, patch }: StateSettingsProps): React.JSX.Element {
  const promptLabel = translate(
    'auto.components.settings.prRules.conflictPrompt',
    'Conflict prompt'
  )
  return (
    <>
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.prRules.resolveConflicts',
          'Resolve conflicts with an agent'
        )}
        description={translate(
          'auto.components.settings.prRules.resolveConflictsDescription',
          'When one of your pull requests lands in the Conflicts column, starts an agent in its workspace that merges the base branch, resolves the conflicts and pushes. Never force-pushes.'
        )}
        checked={config.resolveConflictsWithAgent}
        onChange={() => patch({ resolveConflictsWithAgent: !config.resolveConflictsWithAgent })}
      />
      {config.resolveConflictsWithAgent ? (
        <SettingsRow
          alignTop
          label={promptLabel}
          description={translate(
            'auto.components.settings.prRules.conflictPromptDescription',
            'What the conflict agent is told. Supports {{baseRef}}, {{worktreePath}}, {{prNumber}}, {{title}}, {{author}}, {{branch}}, {{url}} and {{repo}}. Clear the box to go back to the built-in prompt.'
          )}
          control={
            <Textarea
              aria-label={promptLabel}
              value={config.conflictPromptTemplate || DEFAULT_CONFLICT_PROMPT_TEMPLATE}
              onChange={(event) =>
                patch({
                  // Why the built-in text saves as empty: the prompt keeps following upstream's wording.
                  conflictPromptTemplate:
                    event.target.value === DEFAULT_CONFLICT_PROMPT_TEMPLATE
                      ? ''
                      : event.target.value
                })
              }
              className="h-40 w-[320px]"
            />
          }
        />
      ) : null}
    </>
  )
}

/** What a pull request state does beyond picking its column. */
export function ConditionSettings({
  condition,
  config,
  patch
}: StateSettingsProps & { condition: WorkspaceStatusRuleCondition }): React.JSX.Element | null {
  switch (condition) {
    case 'merged':
    case 'closed':
      return <DeleteOnResolvedRow config={config} patch={patch} />
    case 'reviewing':
      return <ReviewingRuleSettings config={config} patch={patch} />
    case 'conflicts':
      return <ConflictAgentSettings config={config} patch={patch} />
    case 'merging':
      return (
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
      )
    case 'pm-approval':
      return (
        <SettingsRow
          label={translate('auto.components.settings.prRules.pmTeam', 'PM approval team')}
          description={translate(
            'auto.components.settings.prRules.pmTeamDescription',
            'As org/team-slug, for example flowbasedk/pm-approval. Leave empty to skip that column.'
          )}
          control={
            <Input
              value={config.pmApprovalTeam ?? ''}
              placeholder={translate(
                'auto.components.settings.prRules.pmTeamPlaceholder',
                'org/team-slug'
              )}
              onChange={(event) => patch({ pmApprovalTeam: event.target.value || null })}
              className="h-7 w-[220px]"
            />
          }
        />
      )
    case 'review':
      return (
        <SettingsRow
          label={translate(
            'auto.components.settings.prRules.reviewCommand',
            'Run a command when your pull request enters Review'
          )}
          description={translate(
            'auto.components.settings.prRules.reviewCommandDescription',
            "Runs once in the workspace's folder each time it moves into the Review column, for example to stop its dev stack. Leave empty to run nothing."
          )}
          control={
            <Input
              value={config.reviewEnteredCommand}
              placeholder={translate(
                'auto.components.settings.prRules.reviewCommandPlaceholder',
                'mise run bd'
              )}
              onChange={(event) => patch({ reviewEnteredCommand: event.target.value })}
              className="h-7 w-[220px] font-mono"
            />
          }
        />
      )
    case 'merge-queue':
    case 'draft':
    case 'changes-requested':
      return null
  }
}
