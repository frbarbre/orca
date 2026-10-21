// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as I18n from '@/i18n/i18n'
import { CiTriageSection } from './CiTriageSection'
import { DEFAULT_CI_TRIAGE_INSTRUCTIONS } from '../../../../shared/ci-triage'

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof I18n>()),
  translate: (_key: string, fallback: string) => fallback
}))

afterEach(cleanup)

const repo = (ciTriage?: { prompt?: string; hints?: string }) =>
  ({ id: 'repo-1', displayName: 'flowbase', path: '/code/flowbase', ciTriage }) as never

describe('CiTriageSection', () => {
  it('turns triage on and off for the repo', async () => {
    const updateRepo = vi.fn()
    const { rerender } = render(<CiTriageSection repo={repo()} updateRepo={updateRepo} />)

    await act(async () =>
      fireEvent.click(screen.getByRole('switch', { name: 'Triage failed CI with an agent' }))
    )
    expect(updateRepo).toHaveBeenLastCalledWith('repo-1', { ciTriage: {} })

    rerender(<CiTriageSection repo={repo({})} updateRepo={updateRepo} />)
    await act(async () =>
      fireEvent.click(screen.getByRole('switch', { name: 'Triage failed CI with an agent' }))
    )
    expect(updateRepo).toHaveBeenLastCalledWith('repo-1', { ciTriage: undefined })
  })

  it('shows the whole default prompt to edit, and saves your edit when you leave the box', async () => {
    const updateRepo = vi.fn()
    render(<CiTriageSection repo={repo({})} updateRepo={updateRepo} />)

    const prompt = screen.getByLabelText('Agent prompt')
    expect(prompt).toHaveValue(DEFAULT_CI_TRIAGE_INSTRUCTIONS)

    fireEvent.change(prompt, { target: { value: 'Rerun everything once.' } })
    await act(async () => fireEvent.blur(prompt))

    expect(updateRepo).toHaveBeenCalledWith('repo-1', {
      ciTriage: { prompt: 'Rerun everything once.' }
    })
  })

  it('resets an edited prompt to the default', async () => {
    const updateRepo = vi.fn()
    render(
      <CiTriageSection repo={repo({ prompt: 'Rerun everything once.' })} updateRepo={updateRepo} />
    )

    expect(screen.getByLabelText('Agent prompt')).toHaveValue('Rerun everything once.')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reset to default' })))

    expect(updateRepo).toHaveBeenLastCalledWith('repo-1', { ciTriage: {} })
    expect(screen.getByLabelText('Agent prompt')).toHaveValue(DEFAULT_CI_TRIAGE_INSTRUCTIONS)
  })

  it('has no reset while the prompt is the default', () => {
    render(<CiTriageSection repo={repo({})} updateRepo={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument()
  })
})
