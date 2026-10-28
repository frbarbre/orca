import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ghExecFileAsync: vi.fn() }))

vi.mock('../../gh-utils', () => ({
  acquire: vi.fn(async () => undefined),
  release: vi.fn(),
  classifyGhError: (message: string) => ({ message }),
  ghExecFileAsync: mocks.ghExecFileAsync
}))
vi.mock('../../github-api-repository', () => ({
  resolveGitHubRepoExecution: vi.fn(async () => ({
    ownerRepo: { owner: 'acme', repo: 'widgets' },
    ghOptions: {}
  }))
}))

import { addPRReviewComment } from './add-pr-review-comment'

const input = {
  repoPath: '/repo',
  prNumber: 7,
  commitId: 'abc123',
  path: 'src/a.ts',
  line: 86,
  body: 'Why nullable?'
}

describe('addPRReviewComment', () => {
  beforeEach(() => {
    mocks.ghExecFileAsync.mockReset()
    mocks.ghExecFileAsync.mockResolvedValue({
      stdout: JSON.stringify({ id: 5, body: 'Why nullable?', user: { login: 'frbarbre' } })
    })
  })

  it('anchors a comment to its line', async () => {
    await addPRReviewComment(input)

    const args: string[] = mocks.ghExecFileAsync.mock.calls[0]?.[0] ?? []
    expect(args).toContain('line=86')
    expect(args).not.toContain('subject_type=file')
  })

  it('attaches a comment on a line outside the diff to the file', async () => {
    const result = await addPRReviewComment({ ...input, startLine: 84, subjectType: 'file' })

    const args: string[] = mocks.ghExecFileAsync.mock.calls[0]?.[0] ?? []
    expect(args).toContain('subject_type=file')
    expect(args.some((arg) => /^(start_)?(line|side)=/.test(arg))).toBe(false)
    expect(result.ok).toBe(true)
  })
})
