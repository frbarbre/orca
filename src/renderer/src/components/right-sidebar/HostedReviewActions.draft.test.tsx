import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import HostedReviewActions from './HostedReviewActions'
import type { HostedReviewActionInfo } from './use-hosted-review-actions'

vi.mock('@/store', () => ({ useAppStore: () => false }))
vi.mock('./use-hosted-review-actions', () => ({
  useHostedReviewActions: () => ({
    stateUpdating: null,
    actionError: null,
    handleReopenReview: vi.fn()
  })
}))

const repo = { id: 'repo-1', path: '/repo' } as Repo
const worktree = { id: 'worktree-1' } as Worktree

function renderDraft(provider: HostedReviewActionInfo['provider']): string {
  return renderToStaticMarkup(
    <HostedReviewActions
      review={{
        provider,
        number: 42,
        state: 'draft',
        status: 'success',
        mergeable: 'UNKNOWN'
      }}
      repo={repo}
      worktree={worktree}
      onRefreshReview={vi.fn().mockResolvedValue(undefined)}
    />
  )
}

describe('HostedReviewActions draft state', () => {
  // Fork: Ready for review lives on the top bar's next-action button and Close in the review
  // header's More actions menu, so a draft gets no panel button.
  it.each(['github', 'gitlab', 'azure-devops', 'gitea'] as const)(
    'renders no button for a %s draft',
    (provider) => {
      expect(renderDraft(provider)).toBe('')
    }
  )
})
