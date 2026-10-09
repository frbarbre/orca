import { describe, expect, it } from 'vitest'
import type { PRComment } from '../../../shared/github/comment-types'
import { findLatestPreviewDeployment, previewDeploymentTooltip } from './preview-deployment'

function comment(id: number, createdAt: string, body: string, extra: Partial<PRComment> = {}) {
  return {
    id,
    author: 'github-actions',
    authorAvatarUrl: '',
    body,
    createdAt,
    url: `https://github.com/acme/app/pull/1#issuecomment-${id}`,
    isBot: true,
    ...extra
  } satisfies PRComment
}

const preview = (sha: string, host: string) =>
  `🔎 **Preview deployment** for \`${sha}\`: https://${host}.flowbase.pages.dev`

describe('findLatestPreviewDeployment', () => {
  it('picks the newest preview comment, with its commit and link', () => {
    const comments = [
      comment(1, '2026-10-09T10:00:00Z', preview('0d7b377', '1c809407')),
      comment(2, '2026-10-09T11:00:00Z', preview('ebe245e', '50156a3b')),
      comment(3, '2026-10-09T10:30:00Z', preview('84bd3d5', '4f14d9c3'))
    ]

    expect(findLatestPreviewDeployment(comments)).toEqual({
      url: 'https://50156a3b.flowbase.pages.dev',
      sha: 'ebe245e',
      createdAt: '2026-10-09T11:00:00Z'
    })
  })

  it('ignores other comments, review comments and previews posted by people', () => {
    const comments = [
      comment(1, '2026-10-09T10:00:00Z', 'Stale Bugbot comment from a previous run.'),
      comment(2, '2026-10-09T11:00:00Z', preview('ebe245e', '50156a3b'), {
        path: 'src/a.ts',
        threadId: 't1'
      }),
      comment(3, '2026-10-09T12:00:00Z', preview('84bd3d5', '4f14d9c3'), { isBot: false })
    ]

    expect(findLatestPreviewDeployment(comments)).toBeNull()
  })
})

describe('previewDeploymentTooltip', () => {
  const deployment = {
    url: 'https://50156a3b.flowbase.pages.dev',
    sha: 'ebe245e',
    createdAt: '2026-10-09T11:00:00Z'
  }
  const now = Date.parse('2026-10-09T11:12:00Z')

  it('says which commit it shows and how old it is', () => {
    expect(previewDeploymentTooltip(deployment, 'ebe245e1234', now)).toBe(
      'Open preview of ebe245e · 12 minutes ago'
    )
  })

  it('flags a preview that is behind the PR head', () => {
    expect(previewDeploymentTooltip(deployment, 'abc9999', now)).toBe(
      'Open preview of ebe245e · 12 minutes ago · not the latest commit'
    )
  })
})
