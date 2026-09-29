import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { launchAgentBackgroundSession } from '@/lib/launch-agent-background-session'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { translate } from '@/i18n/i18n'
import {
  buildResolveConflictsPrompt,
  buildResolvePullRequestConflictsPrompt
} from '../../../../../shared/source-control-conflict-prompts'
import {
  renderSourceControlActionCommandTemplate,
  DEFAULT_SOURCE_CONTROL_ACTION_COMMAND_TEMPLATES
} from '../../../../../shared/source-control-ai-actions'
import {
  resolveSourceControlActionRecipe,
  resolveSourceControlAiInstructions,
  resolveSourceControlAiPrCreationDefaults
} from '../../../../../shared/source-control-ai'
import {
  renderWorkspaceActionPrompt,
  resolveWorkspaceActionPromptTemplate,
  type WorkspaceActionPromptId
} from '../../../../../shared/workspace-action-prompts'
import {
  selectWorkspaceActionContext,
  type WorkspaceActionContext
} from './workspace-action-context'

export type WorkspaceActionLaunch = 'primary' | 'review'

const PROMPT_BY_ACTION: Record<
  Exclude<NonNullable<WorkspaceActionContext['action']>, 'resolve-conflicts'>,
  WorkspaceActionPromptId
> = {
  'commit-and-push': 'commitAndPush',
  'ready-for-review': 'readyForReview',
  'create-pull-request': 'createPullRequest'
}

function buildConflictPrompt(context: WorkspaceActionContext): string {
  const state = useAppStore.getState()
  const basePrompt =
    context.unresolvedConflicts.length > 0
      ? buildResolveConflictsPrompt({
          conflictOperation: state.gitConflictOperationByWorktree[context.worktree.id] ?? 'unknown',
          entries: context.unresolvedConflicts,
          worktreePath: context.worktree.path
        })
      : buildResolvePullRequestConflictsPrompt({
          baseRef: context.pr?.conflictSummary?.baseRef ?? context.pr?.baseRefName,
          entries: (context.pr?.conflictSummary?.files ?? []).map((path) => ({ path })),
          worktreePath: context.worktree.path
        })
  // Why the conflict recipe: it is the template Source Control already offers for this job.
  const recipe = resolveSourceControlActionRecipe({
    settings: state.settings,
    repo: context.repo,
    actionId: 'resolveConflicts'
  })
  return renderSourceControlActionCommandTemplate(
    recipe.commandInputTemplate ?? DEFAULT_SOURCE_CONTROL_ACTION_COMMAND_TEMPLATES.resolveConflicts,
    { basePrompt }
  ).trim()
}

function buildTemplatePrompt(context: WorkspaceActionContext, id: WorkspaceActionPromptId): string {
  const state = useAppStore.getState()
  const settings = state.settings
  const prDefaults = settings
    ? resolveSourceControlAiPrCreationDefaults({ settings, repo: context.repo })
    : null
  const prInstructions = settings
    ? resolveSourceControlAiInstructions({
        settings,
        repo: context.repo,
        operation: 'pullRequest'
      })
    : ''
  const baseRef =
    context.pr?.baseRefName ?? context.worktree.baseRef?.replace(/^origin\//, '') ?? 'main'
  return renderWorkspaceActionPrompt(
    resolveWorkspaceActionPromptTemplate(state.workspaceStatusRules.actionPrompts, id),
    {
      branch: context.branch,
      baseRef,
      worktreePath: context.worktree.path,
      prNumber: context.pr ? String(context.pr.number) : '',
      prUrl: context.pr?.url ?? '',
      prTitle: context.pr?.title ?? '',
      draftMode: prDefaults?.draft ? 'as a draft' : 'ready for review (not a draft)',
      templateRule: prDefaults?.useTemplate
        ? "Fill in the repository's pull request template if it has one."
        : 'Do not use a pull request template.',
      prInstructions: prInstructions
        ? `\nFollow these instructions for the pull request:\n${prInstructions}`
        : ''
    }
  )
}

function actionTitle(kind: WorkspaceActionLaunch, context: WorkspaceActionContext): string {
  if (kind === 'review') {
    return translate('auto.components.workspaceActions.reviewTab', 'Review #{{number}}', {
      number: context.pr?.number ?? ''
    })
  }
  switch (context.action) {
    case 'commit-and-push':
      return translate('auto.components.workspaceActions.commitTab', 'Commit & push')
    case 'resolve-conflicts':
      return translate('auto.components.workspaceActions.conflictsTab', 'Resolve conflicts')
    case 'ready-for-review':
      return translate('auto.components.workspaceActions.readyTab', 'Ready for review')
    case 'create-pull-request':
    case null:
      return translate('auto.components.workspaceActions.createPrTab', 'Create PR')
  }
}

export async function launchWorkspaceAction(kind: WorkspaceActionLaunch): Promise<void> {
  const state = useAppStore.getState()
  const context = selectWorkspaceActionContext(state)
  if (!context || (kind === 'primary' && !context.action) || (kind === 'review' && !context.pr)) {
    return
  }
  const prompt =
    kind === 'review'
      ? buildTemplatePrompt(context, 'reviewPullRequest')
      : context.action === 'resolve-conflicts'
        ? buildConflictPrompt(context)
        : buildTemplatePrompt(context, PROMPT_BY_ACTION[context.action ?? 'create-pull-request'])
  try {
    const launched = await launchAgentBackgroundSession({
      agent: state.workspaceStatusRules.reviewInbox.agent,
      worktreeId: context.worktree.id,
      prompt,
      launchSource: 'unknown',
      title: actionTitle(kind, context)
    })
    if (launched) {
      const store = useAppStore.getState()
      store.setActiveTab(launched.tabId)
      store.setActiveTabType('terminal', context.worktree.id)
      focusTerminalTabSurface(launched.tabId)
    }
  } catch (error) {
    toast.error(
      translate(
        'auto.components.workspaceActions.launchFailed',
        'Could not start the agent: {{reason}}',
        {
          reason: error instanceof Error ? error.message : String(error)
        }
      )
    )
  }
}
