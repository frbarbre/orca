import type { GitHubPRStack } from '../../../../shared/github/pull-request-types'

export function isGitHubPRStackOutOfDate(stack: GitHubPRStack): boolean {
  return Boolean(stack.baseSha && stack.baseTipSha && stack.baseSha !== stack.baseTipSha)
}

export function buildGitHubPRStackRebasePrompt(stack: GitHubPRStack): string {
  const base = stack.baseRefName
  const branches = [...(stack.entries ?? [])]
    .filter((entry) => entry.state !== 'merged' && entry.state !== 'closed')
    .sort((a, b) => a.position - b.position)
    .map((entry) => `- #${entry.number} \`${entry.headRefName ?? 'unknown branch'}\``)
  return [
    `Stack #${stack.number} is out of date with \`${base}\`. Rebase the whole stack onto the latest \`origin/${base}\`.`,
    '',
    'Follow the /fba-stack-prs skill: invoke it now and use its current instructions for rebasing a stack.',
    '',
    `Open PRs in the stack, from the one closest to \`${base}\` up:`,
    ...branches,
    '',
    `- Fetch first, then start with the PR closest to \`${base}\` and work up: rebase it onto \`origin/${base}\`, then each PR above onto the one below it.`,
    '- Resolve every conflict locally as you go.',
    '- Force-pushing is allowed. Push nothing until every branch is rebased, then push them all at once with `--force-with-lease`.',
    '- Do not run validation, tests, lint or typecheck; CI runs them after the push.'
  ].join('\n')
}
