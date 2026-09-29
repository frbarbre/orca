import { buildResolvePullRequestConflictsPrompt } from './source-control-conflict-prompts'

const PUSH_RULE =
  '- Once the merge commit exists and validation passes, push the branch with a plain git push. Never force-push; if the push is rejected, stop and report why.'

export function buildConflictAgentPrompt(input: { baseRef: string; worktreePath: string }): string {
  const prompt = buildResolvePullRequestConflictsPrompt({
    baseRef: input.baseRef,
    entries: [],
    worktreePath: input.worktreePath
  })
  const lines = prompt.split('\n')
  const noPush = lines.findIndex((line) => line.startsWith('- Do not push'))
  // Why replace rather than append: the stock rule forbids pushing, and a later rule contradicting it leaves the agent to pick one.
  if (noPush === -1) {
    const reply = lines.findIndex((line) => line.startsWith('Reply with'))
    lines.splice(reply === -1 ? lines.length : reply - 1, 0, PUSH_RULE)
  } else {
    lines[noPush] = PUSH_RULE
  }
  return lines.join('\n')
}
