// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  GitHubPRStack,
  GitHubPRStackEntry
} from '../../../../shared/github/pull-request-types'
import { GitHubPRStackMap } from './GitHubPRStackMap'

const stack: GitHubPRStack = {
  number: 51,
  position: 2,
  size: 3,
  baseRefName: 'main',
  entries: [
    {
      position: 1,
      number: 201,
      title: 'Models',
      url: 'https://github.com/acme/repo/pull/201',
      state: 'open',
      checksStatus: 'success',
      mergeable: 'MERGEABLE',
      reviewDecision: 'APPROVED'
    },
    {
      position: 2,
      number: 202,
      title: 'API',
      url: 'https://github.com/acme/repo/pull/202',
      state: 'open',
      checksStatus: 'failure',
      mergeable: 'MERGEABLE'
    },
    {
      position: 3,
      number: 203,
      title: 'UI',
      url: 'https://github.com/acme/repo/pull/203',
      state: 'draft',
      checksStatus: 'neutral',
      mergeable: 'UNKNOWN'
    }
  ]
}

let container: HTMLDivElement
let root: Root

describe('GitHubPRStackMap', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows compact identity then expands top-to-bottom with the current PR highlighted', () => {
    act(() => {
      root.render(
        <GitHubPRStackMap stack={stack} currentPRNumber={202} onOpenPullRequest={vi.fn()} />
      )
    })

    expect(container.textContent).toContain('Stack #51')
    expect(container.textContent).toContain('2 of 3 · main')
    expect(container.querySelectorAll('button[data-stack-pr-number]')).toHaveLength(0)

    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Expand stack #51"]'
    )
    act(() => trigger?.click())

    const rows = [...container.querySelectorAll<HTMLButtonElement>('button[data-stack-pr-number]')]
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('#203'),
      expect.stringContaining('#202'),
      expect.stringContaining('#201')
    ])
    expect(rows[1]?.dataset.current).toBe('true')
    expect(container.textContent).toContain('Checks failed')
    expect(container.textContent).toContain('main')
  })

  it('badges each PR with GitHub merge readiness, ignoring checks GitHub does not require', () => {
    const entry = (number: number, fields: Partial<GitHubPRStackEntry>): GitHubPRStackEntry => ({
      position: number,
      number,
      title: `PR ${number}`,
      url: `https://github.com/acme/repo/pull/${number}`,
      state: 'open',
      checksStatus: 'success',
      mergeable: 'MERGEABLE',
      ...fields
    })
    act(() => {
      root.render(
        <GitHubPRStackMap
          stack={{
            ...stack,
            entries: [
              entry(1, { state: 'merged' }),
              entry(2, { checksStatus: 'pending', mergeStateStatus: 'CLEAN' }),
              entry(3, { mergeable: 'CONFLICTING', mergeStateStatus: 'DIRTY' }),
              entry(4, { checksStatus: 'neutral', mergeStateStatus: 'BLOCKED' })
            ]
          }}
          currentPRNumber={2}
          onOpenPullRequest={vi.fn()}
        />
      )
    })
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Expand stack #51"]')?.click()
    )

    const badges = [...container.querySelectorAll<HTMLElement>('[data-stack-pr-status]')].map(
      (badge) => [badge.textContent, badge.dataset.stackPrStatus]
    )
    expect(badges).toEqual([
      ['Not ready', 'pending'],
      ['Conflicts', 'blocked'],
      ['Ready', 'ready'],
      ['Merged', 'merged']
    ])
  })

  it('opens another PR without changing local branches', () => {
    const onOpenPullRequest = vi.fn()
    act(() => {
      root.render(
        <GitHubPRStackMap
          stack={stack}
          currentPRNumber={202}
          onOpenPullRequest={onOpenPullRequest}
        />
      )
    })
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Expand stack #51"]')?.click()
    )
    act(() =>
      container.querySelector<HTMLButtonElement>('button[data-stack-pr-number="203"]')?.click()
    )

    expect(onOpenPullRequest).toHaveBeenCalledTimes(1)
    expect(onOpenPullRequest).toHaveBeenCalledWith(expect.objectContaining({ number: 203 }), {
      metaKey: false,
      ctrlKey: false,
      shiftKey: false
    })
  })
})
