import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_ACTION_PROMPTS,
  renderWorkspaceActionPrompt,
  resolveWorkspaceActionPromptTemplate
} from './workspace-action-prompts'

describe('workspace action prompts', () => {
  it('fills the pull request settings into the create prompt', () => {
    const prompt = renderWorkspaceActionPrompt(DEFAULT_WORKSPACE_ACTION_PROMPTS.createPullRequest, {
      branch: 'feature/e-4861',
      baseRef: 'main',
      worktreePath: '/w',
      draftMode: 'as a draft',
      templateRule: "Fill in the repository's pull request template if it has one.",
      prInstructions: '\nFollow these instructions for the pull request:\nTitle as feat(scope): …'
    })
    expect(prompt).toContain('targeting main')
    expect(prompt).toContain('Create it as a draft with gh pr create.')
    expect(prompt).toContain('Title as feat(scope): …')
    expect(prompt).not.toMatch(/\{\{\w+\}\}/)
  })

  it('uses a saved prompt, and falls back to the built-in one when it is blank', () => {
    expect(
      resolveWorkspaceActionPromptTemplate({ reviewPullRequest: 'Mine' }, 'reviewPullRequest')
    ).toBe('Mine')
    expect(
      resolveWorkspaceActionPromptTemplate({ reviewPullRequest: '  ' }, 'reviewPullRequest')
    ).toBe(DEFAULT_WORKSPACE_ACTION_PROMPTS.reviewPullRequest)
  })
})
