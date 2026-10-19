// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useChecksPanelRerun } from './use-checks-panel-rerun'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const rerunReviewChecks = vi.hoisted(() => vi.fn())
vi.mock('@/lib/rerun-review-checks', () => ({ rerunReviewChecks }))

const repo = { id: 'repo-1', path: '/code/app' } as never
const pr = { number: 7, headSha: 'abc', prRepo: { owner: 'acme', repo: 'app' } }

afterEach(() => vi.clearAllMocks())

describe('useChecksPanelRerun', () => {
  it('reruns the checks, says so, and refreshes them', async () => {
    rerunReviewChecks.mockResolvedValue({ ok: true, count: 2 })
    const refresh = vi.fn(async () => {})
    const { result } = renderHook(() =>
      useChecksPanelRerun({ provider: 'github', repo, pr, refresh })
    )

    await act(async () => result.current.rerunChecks?.(true))

    expect(rerunReviewChecks).toHaveBeenCalledWith({
      repo,
      prNumber: 7,
      headSha: 'abc',
      prRepo: pr.prRepo,
      failedOnly: true
    })
    expect(toast.success).toHaveBeenCalledWith('Check reruns requested')
    expect(refresh).toHaveBeenCalled()
    expect(result.current.isRerunningChecks).toBe(false)
  })

  it('shows why GitHub refused', async () => {
    rerunReviewChecks.mockResolvedValue({
      ok: false,
      error: 'No failed GitHub Actions checks to rerun.'
    })
    const { result } = renderHook(() =>
      useChecksPanelRerun({ provider: 'github', repo, pr, refresh: vi.fn() })
    )

    await act(async () => result.current.rerunChecks?.(true))

    expect(toast.error).toHaveBeenCalledWith('No failed GitHub Actions checks to rerun.')
  })

  it('offers no rerun outside a GitHub pull request', () => {
    const { result } = renderHook(() =>
      useChecksPanelRerun({ provider: 'gitlab', repo, pr, refresh: vi.fn() })
    )

    expect(result.current.rerunChecks).toBeUndefined()
  })
})
