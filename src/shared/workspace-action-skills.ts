import type { WorkspaceStatusRuleConfig } from './workspace-status-rule-config'
import {
  renderWorkspaceActionPrompt,
  resolveWorkspaceActionPromptTemplate,
  type WorkspaceActionPromptId
} from './workspace-action-prompts'

export const WORKSPACE_ACTION_SKILL_NAMES = [
  'orca-commit-and-push',
  'orca-create-pr',
  'orca-ready-for-review',
  'orca-review-pr',
  'orca-rereview-pr'
] as const

export type WorkspaceActionSkillName = (typeof WORKSPACE_ACTION_SKILL_NAMES)[number]

export type WorkspaceActionSkill = { name: WorkspaceActionSkillName; content: string }

export type WorkspaceActionSkillConfig = Pick<
  WorkspaceStatusRuleConfig,
  'actionPrompts' | 'reviewInbox'
>

export type WorkspaceActionSkillPrDefaults = {
  draft: boolean
  useTemplate: boolean
  prInstructions: string
}

const PR_LOOKUP = '`gh pr view --json number,url,title,baseRefName` for this branch'

const ACTION_VARIABLE_SOURCES: Record<string, string> = {
  branch: '`git branch --show-current`',
  worktreePath: '`git rev-parse --show-toplevel`',
  baseRef: `\`baseRefName\` from ${PR_LOOKUP}; with no pull request, the repository's default branch (\`gh repo view --json defaultBranchRef -q .defaultBranchRef.name\`)`,
  prNumber: `\`number\` from ${PR_LOOKUP}`,
  prUrl: `\`url\` from ${PR_LOOKUP}`,
  prTitle: `\`title\` from ${PR_LOOKUP}`
}

const REVIEW_LOOKUP = 'the `gh pr view` result'

const REVIEW_VARIABLE_SOURCES: Record<string, string> = {
  prNumber: `\`number\` from ${REVIEW_LOOKUP}`,
  title: `\`title\` from ${REVIEW_LOOKUP}`,
  author: `\`author.login\` from ${REVIEW_LOOKUP}`,
  branch: `\`headRefName\` from ${REVIEW_LOOKUP}`,
  baseRef: `\`baseRefName\` from ${REVIEW_LOOKUP}`,
  url: `\`url\` from ${REVIEW_LOOKUP}`,
  repo: '`gh repo view --json nameWithOwner -q .nameWithOwner`',
  sinceCommit:
    'the commit of your latest review on it: `gh api repos/<repo>/pulls/<number>/reviews --paginate --jq \'[.[] | select(.user.login == "<you>")] | last | .commit_id\'` with `<repo>` from `gh repo view --json nameWithOwner -q .nameWithOwner` and `<you>` from `gh api user -q .login`; with no earlier review, `baseRefName`',
  worktreePath: '`worktree.path` from the `orca worktree create` result'
}

type ActionSkillSpec = {
  name: WorkspaceActionSkillName
  promptId: WorkspaceActionPromptId
  title: string
  summary: string
}

const ACTION_SKILLS: readonly ActionSkillSpec[] = [
  {
    name: 'orca-commit-and-push',
    promptId: 'commitAndPush',
    title: 'Commit & push',
    summary: 'commits and pushes the work in this worktree'
  },
  {
    name: 'orca-create-pr',
    promptId: 'createPullRequest',
    title: 'Create PR',
    summary: "commits and pushes this worktree's work and opens a pull request for its branch"
  },
  {
    name: 'orca-ready-for-review',
    promptId: 'readyForReview',
    title: 'Ready for review',
    summary: "gets this branch's draft pull request ready for review and marks it ready"
  }
]

function usedVariables(template: string): string[] {
  const names = new Set<string>()
  for (const match of template.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    names.add(match[1])
  }
  return [...names]
}

function variableList(template: string, sources: Record<string, string>): string {
  const lines = usedVariables(template)
    .filter((name) => sources[name])
    .map((name) => `   - \`{{${name}}}\`: ${sources[name]}`)
  return lines.length > 0 ? lines.join('\n') : '   - Nothing to fill in.'
}

function frontmatter(name: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n`
}

const GENERATED_NOTE =
  'Orca writes this skill from its Automations settings and rewrites it whenever they change, so edit the prompt there, not here.'

function buildActionSkill(
  spec: ActionSkillSpec,
  config: WorkspaceActionSkillConfig,
  prDefaults: WorkspaceActionSkillPrDefaults
): WorkspaceActionSkill {
  const template = renderWorkspaceActionPrompt(
    resolveWorkspaceActionPromptTemplate(config.actionPrompts, spec.promptId),
    {
      draftMode: prDefaults.draft ? 'as a draft' : 'ready for review (not a draft)',
      templateRule: prDefaults.useTemplate
        ? "Fill in the repository's pull request template if it has one."
        : 'Do not use a pull request template.',
      prInstructions: prDefaults.prInstructions
        ? `\nFollow these instructions for the pull request:\n${prDefaults.prInstructions}`
        : ''
    }
  )
  const description = `Start a new Orca agent in the current worktree that ${spec.summary}, using the "${spec.title}" prompt from Orca's top bar. Use when the user asks for "${spec.title.toLowerCase()}" or runs /${spec.name}.`
  const content = `${frontmatter(spec.name, description)}
# ${spec.title}

${GENERATED_NOTE}

Do not do this work yourself. Hand it to a new agent in this worktree:

1. Fill in the prompt below, replacing each placeholder:
${variableList(template, ACTION_VARIABLE_SOURCES)}
2. Write the filled-in prompt to a temporary file and launch the agent with it:
   \`orca agent launch --agent ${config.reviewInbox.agent} --worktree active --prompt "$(cat <file>)" --json\`
3. Reply with the agent handle (\`launch.outcome.handle\`) and stop. Do not wait for the agent to finish.

## Prompt

${template}
`
  return { name: spec.name, content }
}

function buildReviewSkill(
  name: WorkspaceActionSkillName,
  rereview: boolean,
  config: WorkspaceActionSkillConfig
): WorkspaceActionSkill {
  const template = rereview
    ? config.reviewInbox.rereviewPromptTemplate
    : config.reviewInbox.promptTemplate
  const title = rereview ? 'Re-review a pull request' : 'Review a pull request'
  const description = rereview
    ? `Check out a pull request you reviewed before in a new Orca worktree and start an agent there with Orca's re-review prompt. Use when the user asks to re-review a pull request or runs /${name} <number or URL>.`
    : `Check out a pull request in a new Orca worktree and start an agent there with Orca's review prompt. Use when the user asks to review a pull request or runs /${name} <number or URL>.`
  const content = `${frontmatter(name, description)}
# ${title}

${GENERATED_NOTE}

Do not review it yourself. Hand it to a new agent in its own worktree. The user names the pull request by number or URL; ask if they did not.

1. Look it up: \`gh pr view <number or URL> --json number,title,author,url,headRefName,baseRefName\`. Run it, and the commands below, from a checkout of the pull request's repository.
2. Fetch its head into a local branch: \`git fetch origin +pull/<number>/head:orca-review-<number>\`.
3. Create the worktree: \`orca worktree create --name review-<number> --base-branch orca-review-<number> --pr <number> --no-parent --json\`. Keep \`worktree.id\` and \`worktree.path\` from the result.
4. Fill in the prompt below, replacing each placeholder:
${variableList(template, REVIEW_VARIABLE_SOURCES)}
5. Write the filled-in prompt to a temporary file and launch the agent with it:
   \`orca agent launch --agent ${config.reviewInbox.agent} --worktree id:<worktree.id> --prompt "$(cat <file>)" --json\`
6. Reply with the worktree path and the agent handle (\`launch.outcome.handle\`), and stop. Do not wait for the review.

## Prompt

${template.trim()}
`
  return { name, content }
}

export function buildWorkspaceActionSkills(
  config: WorkspaceActionSkillConfig,
  prDefaults: WorkspaceActionSkillPrDefaults
): WorkspaceActionSkill[] {
  return [
    ...ACTION_SKILLS.map((spec) => buildActionSkill(spec, config, prDefaults)),
    buildReviewSkill('orca-review-pr', false, config),
    buildReviewSkill('orca-rereview-pr', true, config)
  ]
}
