// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PRCheckDetail } from '../../../../../shared/github/check-types'
import { PRTriageStrip } from './triage-strip'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

afterEach(cleanup)

const failing: PRCheckDetail[] = [
  { name: 'verify', status: 'completed', conclusion: 'failure', url: null },
  { name: 'lint', status: 'completed', conclusion: 'success', url: null }
]

async function openRerunMenu(): Promise<void> {
  await act(async () => {
    fireEvent.pointerDown(screen.getByRole('button', { name: /Rerun/ }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse'
    })
  })
}

describe('the failing-checks row', () => {
  it('reruns only the failed checks, or the whole CI', async () => {
    const onRerunChecks = vi.fn()
    render(
      <PRTriageStrip
        checks={failing}
        isResolvingConflictsWithAI={false}
        onResolveConflictsWithAI={vi.fn()}
        isFixingChecksWithAI={false}
        onFixChecksWithAI={vi.fn()}
        onRerunChecks={onRerunChecks}
      />
    )

    await openRerunMenu()
    await act(async () =>
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rerun failed checks' }))
    )
    expect(onRerunChecks).toHaveBeenLastCalledWith(true)

    await openRerunMenu()
    await act(async () =>
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rerun all checks' }))
    )
    expect(onRerunChecks).toHaveBeenLastCalledWith(false)
  })

  it('offers rerun without the AI fix when AI actions are off', () => {
    render(
      <PRTriageStrip
        checks={failing}
        isResolvingConflictsWithAI={false}
        onResolveConflictsWithAI={vi.fn()}
        isFixingChecksWithAI={false}
        onRerunChecks={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Rerun/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Fix/ })).not.toBeInTheDocument()
  })

  it('says it is rerunning while the request is out', () => {
    render(
      <PRTriageStrip
        checks={failing}
        isResolvingConflictsWithAI={false}
        onResolveConflictsWithAI={vi.fn()}
        isFixingChecksWithAI={false}
        onRerunChecks={vi.fn()}
        isRerunningChecks
      />
    )

    expect(screen.getByRole('button', { name: /Rerun/ })).toBeDisabled()
  })
})
