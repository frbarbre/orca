import React from 'react'
import { useAppStore } from '@/store'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import {
  DEFAULT_WORKSPACE_ACTION_PROMPTS,
  WORKSPACE_ACTION_PROMPT_IDS,
  type WorkspaceActionPromptId
} from '../../../../shared/workspace-action-prompts'
import { SettingsRow } from './SettingsFormControls'

function promptLabel(id: WorkspaceActionPromptId): string {
  switch (id) {
    case 'commitAndPush':
      return translate('auto.components.settings.workspaceActions.commitAndPush', 'Commit & push')
    case 'createPullRequest':
      return translate('auto.components.settings.workspaceActions.createPr', 'Create PR')
    case 'readyForReview':
      return translate('auto.components.settings.workspaceActions.ready', 'Ready for review')
    case 'reviewPullRequest':
      return translate('auto.components.settings.workspaceActions.review', 'Review')
  }
}

export function WorkspaceActionPromptsSection(): React.JSX.Element {
  const config = useAppStore((state) => state.workspaceStatusRules)
  const setWorkspaceStatusRules = useAppStore((state) => state.setWorkspaceStatusRules)
  const update = (id: WorkspaceActionPromptId, value: string): void => {
    const actionPrompts = { ...config.actionPrompts }
    // Why the default is not stored: an untouched box keeps following the built-in prompt.
    if (value.trim() && value !== DEFAULT_WORKSPACE_ACTION_PROMPTS[id]) {
      actionPrompts[id] = value
    } else {
      delete actionPrompts[id]
    }
    setWorkspaceStatusRules({ ...config, actionPrompts })
  }
  return (
    <section className="divide-y divide-border">
      <div className="py-3">
        <h3 className="text-sm font-medium">
          {translate('auto.components.settings.workspaceActions.title', 'Top bar actions')}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.workspaceActions.description',
            'Prompts for the buttons beside the right sidebar toggle. Supports {{branch}}, {{baseRef}}, {{worktreePath}}, {{prNumber}}, {{prUrl}}, {{prTitle}}, {{draftMode}}, {{templateRule}} and {{prInstructions}}. Resolve conflicts uses the Source Control conflict template. Clear a box to go back to the built-in prompt.'
          )}
        </p>
      </div>
      {WORKSPACE_ACTION_PROMPT_IDS.map((id) => (
        <SettingsRow
          key={id}
          alignTop
          label={promptLabel(id)}
          control={
            <Textarea
              value={config.actionPrompts[id] ?? DEFAULT_WORKSPACE_ACTION_PROMPTS[id]}
              onChange={(event) => update(id, event.target.value)}
              className="h-40 w-[320px]"
            />
          }
        />
      ))}
    </section>
  )
}
