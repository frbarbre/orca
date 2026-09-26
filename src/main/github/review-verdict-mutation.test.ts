import { describe, expect, it } from 'vitest'
import type { PendingReviewComment } from '../../shared/github/pending-review-comment'
import { buildPullRequestNodeIdQuery, buildReviewVerdictMutation } from './review-verdict-mutation'

function draft(overrides: Partial<PendingReviewComment> = {}): PendingReviewComment {
  return { id: 'a', path: 'src/app.ts', line: 12, body: 'this leaks', createdAt: 1, ...overrides }
}

const base = { pullRequestId: 'PR_abc', body: 'looks good' } as const

describe('buildReviewVerdictMutation', () => {
  it('maps each verdict to its provider event', () => {
    for (const [verdict, event] of [
      ['comment', 'COMMENT'],
      ['approve', 'APPROVE'],
      ['request-changes', 'REQUEST_CHANGES']
    ] as const) {
      const mutation = buildReviewVerdictMutation({ ...base, verdict, comments: [] })
      expect(mutation).toContain(`event: ${event}`)
    }
  })

  it('emits one thread per queued comment', () => {
    const mutation = buildReviewVerdictMutation({
      ...base,
      verdict: 'comment',
      comments: [draft(), draft({ id: 'b', path: 'src/other.ts', line: 3 })]
    })

    expect(mutation).toContain('path: "src/app.ts", line: 12, side: RIGHT')
    expect(mutation).toContain('path: "src/other.ts", line: 3, side: RIGHT')
  })

  it('omits the threads argument entirely when nothing is queued', () => {
    expect(buildReviewVerdictMutation({ ...base, verdict: 'approve', comments: [] })).not.toContain(
      'threads'
    )
  })

  it('declares a range only for a real multi-line comment', () => {
    const single = buildReviewVerdictMutation({
      ...base,
      verdict: 'comment',
      comments: [draft({ startLine: 12 })]
    })
    const ranged = buildReviewVerdictMutation({
      ...base,
      verdict: 'comment',
      comments: [draft({ startLine: 9 })]
    })

    expect(single).not.toContain('startLine')
    expect(ranged).toContain('startLine: 9, startSide: RIGHT')
  })

  it('escapes a body that would otherwise break the document', () => {
    const mutation = buildReviewVerdictMutation({
      pullRequestId: 'PR_abc',
      body: 'has "quotes"\nand a newline',
      verdict: 'comment',
      comments: [draft({ body: 'closing } brace and "quote"' })]
    })

    expect(mutation).toContain('"has \\"quotes\\"\\nand a newline"')
    expect(mutation).toContain('"closing } brace and \\"quote\\""')
    // Why: a naive builder would end the input early on the embedded brace.
    expect(mutation.endsWith('} }')).toBe(true)
  })
})

describe('buildPullRequestNodeIdQuery', () => {
  it('addresses the pull request by owner, repo and number', () => {
    expect(
      buildPullRequestNodeIdQuery({ owner: 'flowbasedk', repo: 'flowbase', number: 3170 })
    ).toContain('repository(owner: "flowbasedk", name: "flowbase") { pullRequest(number: 3170)')
  })
})
