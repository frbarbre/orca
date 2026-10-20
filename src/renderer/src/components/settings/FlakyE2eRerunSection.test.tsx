// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as I18n from '@/i18n/i18n'
import { FlakyE2eRerunSection } from './FlakyE2eRerunSection'

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof I18n>()),
  translate: (_key: string, fallback: string) => fallback
}))

const repo = { id: 'repo-1', displayName: 'flowbase', path: '/code/flowbase' } as never

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('FlakyE2eRerunSection', () => {
  const saveSentryToken = vi.fn(async () => {})
  beforeEach(() => {
    vi.stubGlobal('api', {
      pendingReview: {
        sentryTokenConfigured: vi.fn(async () => false),
        saveSentryToken,
        clearSentryToken: vi.fn(async () => {})
      }
    })
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('saves the whole lookup once it is complete', async () => {
    const updateRepo = vi.fn()
    render(<FlakyE2eRerunSection repo={repo} updateRepo={updateRepo} />)

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    type('Sentry URL', 'https://de.sentry.io')
    type('Sentry organization', 'flowbasedk')
    type('Sentry project ids', '11, 22')
    type('Report artifact', 'e2e-report')
    type('Report file', 'results.json')
    type('Issue search', 'is:unresolved test_file:{file} test_title:{title}')
    await act(async () => fireEvent.click(save))

    expect(updateRepo).toHaveBeenCalledWith('repo-1', {
      flakyE2eRerun: {
        sentryUrl: 'https://de.sentry.io',
        sentryOrg: 'flowbasedk',
        sentryProjectIds: ['11', '22'],
        reportArtifact: 'e2e-report',
        reportFile: 'results.json',
        queryTemplate: 'is:unresolved test_file:{file} test_title:{title}'
      }
    })
  })

  it('stores the Sentry token encrypted, apart from the repo', async () => {
    render(<FlakyE2eRerunSection repo={repo} updateRepo={vi.fn()} />)

    type('Sentry token', 'sntryu_secret')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save token' })))

    expect(saveSentryToken).toHaveBeenCalledWith('sntryu_secret')
  })
})
