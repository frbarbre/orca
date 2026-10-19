import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PRCheckDetail } from '../../../../../shared/github/check-types'
import { ChecksList } from './checks-list'

function render(checks: PRCheckDetail[]): string {
  return renderToStaticMarkup(
    React.createElement(
      TooltipProvider,
      null,
      React.createElement(ChecksList, {
        checks,
        checksLoading: false,
        checkDetailsContextKey: 'repo:42',
        onLoadCheckDetails: async () => null
      })
    )
  )
}

describe('check row duration', () => {
  it('shows how long a finished job ran, next to its status', () => {
    const markup = render([
      {
        name: 'lint',
        status: 'completed',
        conclusion: 'success',
        url: null,
        startedAt: '2026-10-19T14:00:00Z',
        completedAt: '2026-10-19T14:04:05Z'
      }
    ])

    expect(markup).toContain('4m 5s')
  })

  it('shows nothing for a check without times, like a commit status', () => {
    const markup = render([
      { name: 'Combined CI', status: 'completed', conclusion: 'failure', url: null }
    ])

    expect(markup).not.toMatch(/\d+s</)
  })
})
