import { describe, expect, it } from 'vitest'
import type { ReviewSnapshotPullRequest } from './github/review-status-snapshot-types'
import {
  buildReviewPromptVariables,
  renderWorkspaceStatusRulePrompt
} from './workspace-status-rule-prompt'
import { DEFAULT_REVIEW_PROMPT_TEMPLATE } from './workspace-status-rule-config'

const pr: ReviewSnapshotPullRequest = {
  repo: { owner: 'flowbasedk', repo: 'flowbase' },
  number: 42,
  title: 'Tidy the timeline',
  url: 'https://github.com/flowbasedk/flowbase/pull/42',
  author: 'colleague',
  isDraft: false,
  state: 'OPEN',
  headRefName: 'fix/timeline',
  baseRefName: 'main',
  headRefOid: 'deadbeef',
  requestedReviewers: [],
  latestReviews: [],
  checks: []
}

describe('renderWorkspaceStatusRulePrompt', () => {
  it('substitutes every supported variable', () => {
    const rendered = renderWorkspaceStatusRulePrompt(
      '{{prNumber}} {{title}} {{author}} {{branch}} {{baseRef}} {{url}} {{repo}}',
      buildReviewPromptVariables(pr)
    )

    expect(rendered).toBe(
      '42 Tidy the timeline colleague fix/timeline main https://github.com/flowbasedk/flowbase/pull/42 flowbasedk/flowbase'
    )
  })

  it('tolerates padding inside the braces', () => {
    expect(
      renderWorkspaceStatusRulePrompt('{{  prNumber  }}', buildReviewPromptVariables(pr))
    ).toBe('42')
  })

  it('leaves an unknown placeholder verbatim', () => {
    expect(renderWorkspaceStatusRulePrompt('{{nope}}', buildReviewPromptVariables(pr))).toBe(
      '{{nope}}'
    )
  })

  it('falls back to a readable author when the pull request has none', () => {
    expect(buildReviewPromptVariables({ ...pr, author: null }).author).toBe('unknown')
  })

  it('leaves no placeholder behind in the shipped default template', () => {
    const rendered = renderWorkspaceStatusRulePrompt(
      DEFAULT_REVIEW_PROMPT_TEMPLATE,
      buildReviewPromptVariables(pr)
    )

    expect(rendered).not.toMatch(/\{\{/)
    expect(rendered).toContain('#42')
  })
})
