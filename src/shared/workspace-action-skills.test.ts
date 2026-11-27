import { describe, expect, it } from 'vitest'
import { cloneDefaultWorkspaceStatusRuleConfig } from './workspace-status-rule-config'
import { WORKSPACE_ACTION_SKILL_NAMES, buildWorkspaceActionSkills } from './workspace-action-skills'

const PR_DEFAULTS = { draft: true, useTemplate: false, prInstructions: 'Keep the title short.' }

function skillByName(skills: ReturnType<typeof buildWorkspaceActionSkills>, name: string): string {
  const skill = skills.find((entry) => entry.name === name)
  if (!skill) {
    throw new Error(`missing ${name}`)
  }
  return skill.content
}

describe('buildWorkspaceActionSkills', () => {
  it('writes one skill per action and review prompt', () => {
    const skills = buildWorkspaceActionSkills(cloneDefaultWorkspaceStatusRuleConfig(), PR_DEFAULTS)
    expect(skills.map((skill) => skill.name)).toEqual([...WORKSPACE_ACTION_SKILL_NAMES])
    for (const skill of skills) {
      expect(skill.content.startsWith(`---\nname: ${skill.name}\ndescription: `)).toBe(true)
    }
  })

  it('carries the edited prompt and launches the configured agent in this worktree', () => {
    const config = cloneDefaultWorkspaceStatusRuleConfig()
    config.actionPrompts = { readyForReview: 'Polish #{{prNumber}} on {{branch}} then mark it.' }
    config.reviewInbox.agent = 'codex'
    const content = skillByName(
      buildWorkspaceActionSkills(config, PR_DEFAULTS),
      'orca-ready-for-review'
    )
    expect(content).toContain('Polish #{{prNumber}} on {{branch}} then mark it.')
    expect(content).toContain('`{{prNumber}}`')
    expect(content).toContain('`{{branch}}`')
    expect(content).not.toContain('`{{prTitle}}`')
    expect(content).toContain('orca agent launch --agent codex --worktree active')
  })

  it('fills the source control PR settings into the Create PR prompt up front', () => {
    const content = skillByName(
      buildWorkspaceActionSkills(cloneDefaultWorkspaceStatusRuleConfig(), PR_DEFAULTS),
      'orca-create-pr'
    )
    expect(content).toContain('Create it as a draft with gh pr create.')
    expect(content).toContain('Do not use a pull request template.')
    expect(content).toContain('Keep the title short.')
    expect(content).not.toContain('{{draftMode}}')
  })

  it('checks a pull request out in a new worktree for both review prompts', () => {
    const config = cloneDefaultWorkspaceStatusRuleConfig()
    config.reviewInbox.rereviewPromptTemplate = 'Again: {{title}} since {{sinceCommit}}.'
    const skills = buildWorkspaceActionSkills(config, PR_DEFAULTS)
    const review = skillByName(skills, 'orca-review-pr')
    const rereview = skillByName(skills, 'orca-rereview-pr')
    expect(review).toContain(config.reviewInbox.promptTemplate)
    expect(rereview).toContain('Again: {{title}} since {{sinceCommit}}.')
    expect(rereview).toContain('`{{sinceCommit}}`')
    for (const content of [review, rereview]) {
      expect(content).toContain('orca worktree create')
      expect(content).toContain('--pr <number>')
      expect(content).toContain('orca agent launch --agent claude --worktree id:<worktree.id>')
    }
  })
})
