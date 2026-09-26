import type { ReviewSnapshotPullRequest } from './github/review-status-snapshot-types'

export const WORKSPACE_STATUS_RULE_PROMPT_VARIABLES = [
  'prNumber',
  'title',
  'author',
  'branch',
  'baseRef',
  'url',
  'repo',
  'sinceCommit'
] as const

export type WorkspaceStatusRulePromptVariable =
  (typeof WORKSPACE_STATUS_RULE_PROMPT_VARIABLES)[number]

export function buildReviewPromptVariables(
  pr: ReviewSnapshotPullRequest,
  /** The commit a re-review is diffed against; absent on a first look. */
  sinceCommit?: string
): Record<WorkspaceStatusRulePromptVariable, string> {
  return {
    prNumber: String(pr.number),
    title: pr.title,
    author: pr.author ?? 'unknown',
    branch: pr.headRefName,
    baseRef: pr.baseRefName,
    url: pr.url,
    repo: `${pr.repo.owner}/${pr.repo.repo}`,
    sinceCommit: sinceCommit ?? pr.baseRefName
  }
}

// Why: an unknown placeholder is left verbatim rather than blanked, so a typo in
// a template is visible in the prompt instead of silently deleting context.
export function renderWorkspaceStatusRulePrompt(
  template: string,
  variables: Partial<Record<WorkspaceStatusRulePromptVariable, string>>
): string {
  const byName = new Map<string, string>()
  for (const name of WORKSPACE_STATUS_RULE_PROMPT_VARIABLES) {
    const value = variables[name]
    if (value !== undefined) {
      byName.set(name, value)
    }
  }
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, name: string) => {
    return byName.get(name) ?? match
  })
}
