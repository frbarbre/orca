export const WORKSPACE_ACTION_PROMPT_IDS = [
  'commitAndPush',
  'createPullRequest',
  'readyForReview',
  'reviewPullRequest'
] as const

export type WorkspaceActionPromptId = (typeof WORKSPACE_ACTION_PROMPT_IDS)[number]

export const WORKSPACE_ACTION_PROMPT_VARIABLES = [
  'branch',
  'baseRef',
  'worktreePath',
  'prNumber',
  'prUrl',
  'prTitle',
  'draftMode',
  'prInstructions',
  'templateRule'
] as const

export type WorkspaceActionPromptVariable = (typeof WORKSPACE_ACTION_PROMPT_VARIABLES)[number]

export const DEFAULT_WORKSPACE_ACTION_PROMPTS: Record<WorkspaceActionPromptId, string> = {
  commitAndPush: `Commit and push the work in this worktree ({{worktreePath}}, branch {{branch}}).

- Start with git status and git diff to see what changed.
- Group the changes into focused commits with clear messages that follow the repository's conventions.
- Do not commit secrets, build output or unrelated files; stop and ask if something looks accidental.
- Push the branch, setting the upstream if it has none. Never force-push; if the push is rejected, stop and report why.

Reply with the commits you made and the result of the push.`,
  createPullRequest: `Open a pull request for branch {{branch}} in {{worktreePath}}, targeting {{baseRef}}.

- Make sure everything is committed and the branch is pushed; push it (never force) if it is not.
- Write the title and description from the commits and the diff against {{baseRef}}.
- {{templateRule}}
- Create it {{draftMode}} with gh pr create.
{{prInstructions}}

Reply with the pull request URL.`,
  readyForReview: `Get pull request #{{prNumber}} ({{prUrl}}) ready for review and mark it ready.

- Check that the branch is pushed and the checks are passing; fix anything small that is failing, and stop and report anything that is not.
- Make sure the title and description still match what the branch now does, and update them if they do not.
- Then mark it ready with gh pr ready {{prNumber}}.

Reply with what you checked, anything you changed, and the final state.`,
  reviewPullRequest: `Review pull request #{{prNumber}} — "{{prTitle}}" ({{prUrl}}).
The branch {{branch}} is checked out in {{worktreePath}}; compare it against {{baseRef}}.

- Read the full diff and the surrounding code it touches.
- Point out bugs, missing edge cases, risky changes and anything that does not fit how the codebase already does things.
- Order findings by severity, each with the file and line and a concrete suggestion.
- Do not change any code.`
}

export function resolveWorkspaceActionPromptTemplate(
  custom: Partial<Record<WorkspaceActionPromptId, string>> | undefined,
  id: WorkspaceActionPromptId
): string {
  return custom?.[id]?.trim() || DEFAULT_WORKSPACE_ACTION_PROMPTS[id]
}

export function renderWorkspaceActionPrompt(
  template: string,
  variables: Partial<Record<WorkspaceActionPromptVariable, string>>
): string {
  const byName = new Map<string, string | undefined>(Object.entries(variables))
  return template
    .replace(/\{\{(\w+)\}\}/g, (match, name: string) => byName.get(name) ?? match)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
