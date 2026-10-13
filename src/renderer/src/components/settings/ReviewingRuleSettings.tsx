import { Textarea } from '@/components/ui/textarea'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { translate } from '@/i18n/i18n'
import type {
  ReviewAgentView,
  WorkspaceStatusRuleConfig
} from '../../../../shared/workspace-status-rule-config'
import { SettingsRow, SettingsSwitchRow } from './SettingsFormControls'

function reviewViewOptions(): { id: ReviewAgentView; label: string }[] {
  return [
    { id: 'chat', label: translate('auto.components.settings.prRules.reviewViewChat', 'Chat UI') },
    {
      id: 'terminal',
      label: translate('auto.components.settings.prRules.reviewViewTerminal', 'Terminal')
    },
    {
      id: 'claude-web',
      label: translate('auto.components.settings.prRules.reviewViewClaudeWeb', 'Claude web')
    },
    {
      id: 'default',
      label: translate('auto.components.settings.prRules.reviewViewDefault', 'Default')
    }
  ]
}

// Fork: everything about pull requests you are asked to review, on the Reviewing tab.
export function ReviewingRuleSettings({
  config,
  patch
}: {
  config: WorkspaceStatusRuleConfig
  patch: (updates: Partial<WorkspaceStatusRuleConfig>) => void
}): React.JSX.Element {
  const inbox = config.reviewInbox
  return (
    <>
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.prRules.reviewInbox',
          'Open a workspace when you are asked to review'
        )}
        description={translate(
          'auto.components.settings.prRules.reviewInboxDescription',
          'Creates the workspace, points the diff at the pull request base, and starts the agent on the prompt below. Every review already waiting on you is picked up on the first check.'
        )}
        checked={inbox.enabled}
        onChange={() => patch({ reviewInbox: { ...inbox, enabled: !inbox.enabled } })}
      />
      {inbox.enabled ? (
        <>
          <SettingsRow
            label={translate('auto.components.settings.prRules.reviewView', 'Open the review in')}
            description={translate(
              'auto.components.settings.prRules.reviewViewDescription',
              "Which view the review agent's tab starts in. Default follows your default view."
            )}
            control={
              <SegmentedTabs
                options={reviewViewOptions()}
                value={inbox.view}
                onChange={(view) => patch({ reviewInbox: { ...inbox, view } })}
                ariaLabel={translate(
                  'auto.components.settings.prRules.reviewView',
                  'Open the review in'
                )}
              />
            }
          />
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
                value={inbox.promptTemplate}
                onChange={(event) =>
                  patch({ reviewInbox: { ...inbox, promptTemplate: event.target.value } })
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
                value={inbox.rereviewPromptTemplate}
                onChange={(event) =>
                  patch({ reviewInbox: { ...inbox, rereviewPromptTemplate: event.target.value } })
                }
                className="h-40 w-[320px]"
              />
            }
          />
        </>
      ) : null}
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
        onChange={() => patch({ onReviewed: config.onReviewed === 'delete' ? 'none' : 'delete' })}
      />
    </>
  )
}
