import { describe, expect, it } from 'vitest'
import { ciTriageFetchTargets } from './ci-triage-watch'

const triageRepo = { id: 'repo-1', path: '/code/app', ciTriage: {} }
const plainRepo = { id: 'repo-2', path: '/code/other' }
const pr = (number: number, checksStatus: string, state = 'open') => ({
  data: {
    number,
    state,
    checksStatus,
    headSha: `sha-${number}`,
    prRepo: { owner: 'acme', repo: 'app' }
  }
})

describe('ciTriageFetchTargets', () => {
  it('picks the open PRs whose sidebar status is failed, in repos with CI triage on', () => {
    const workspaces = [
      { repo: triageRepo, candidate: { cacheKey: 'k-failed', branch: 'feature' } },
      { repo: triageRepo, candidate: { cacheKey: 'k-passing', branch: 'green' } },
      { repo: triageRepo, candidate: { cacheKey: 'k-merged', branch: 'old' } },
      { repo: triageRepo, candidate: { cacheKey: 'k-none', branch: 'no-pr' } },
      { repo: plainRepo, candidate: { cacheKey: 'k-other', branch: 'feature' } }
    ]
    const prCache = {
      'k-failed': pr(7, 'failure'),
      'k-passing': pr(8, 'success'),
      'k-merged': pr(9, 'failure', 'merged'),
      'k-other': pr(10, 'failure')
    }

    expect(ciTriageFetchTargets(workspaces as never, prCache as never)).toEqual([
      {
        repo: triageRepo,
        prNumber: 7,
        branch: 'feature',
        headSha: 'sha-7',
        prRepo: { owner: 'acme', repo: 'app' }
      }
    ])
  })
})
