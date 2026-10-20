// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as I18n from '@/i18n/i18n'
import { CiTriageSection } from './CiTriageSection'

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof I18n>()),
  translate: (_key: string, fallback: string) => fallback
}))

afterEach(cleanup)

const repo = (ciTriage?: { hints: string }) =>
  ({ id: 'repo-1', displayName: 'flowbase', path: '/code/flowbase', ciTriage }) as never

describe('CiTriageSection', () => {
  it('turns triage on and off for the repo', async () => {
    const updateRepo = vi.fn()
    const { rerender } = render(<CiTriageSection repo={repo()} updateRepo={updateRepo} />)

    await act(async () =>
      fireEvent.click(screen.getByRole('switch', { name: 'Triage failed CI with an agent' }))
    )
    expect(updateRepo).toHaveBeenLastCalledWith('repo-1', { ciTriage: { hints: '' } })

    rerender(<CiTriageSection repo={repo({ hints: '' })} updateRepo={updateRepo} />)
    await act(async () =>
      fireEvent.click(screen.getByRole('switch', { name: 'Triage failed CI with an agent' }))
    )
    expect(updateRepo).toHaveBeenLastCalledWith('repo-1', { ciTriage: undefined })
  })

  it("saves the agent's hints when you leave the box", async () => {
    const updateRepo = vi.fn()
    render(<CiTriageSection repo={repo({ hints: '' })} updateRepo={updateRepo} />)

    const hints = screen.getByLabelText('What the agent should know')
    fireEvent.change(hints, { target: { value: 'Our Sentry is flowbasedk.sentry.io.' } })
    await act(async () => fireEvent.blur(hints))

    expect(updateRepo).toHaveBeenCalledWith('repo-1', {
      ciTriage: { hints: 'Our Sentry is flowbasedk.sentry.io.' }
    })
  })
})
