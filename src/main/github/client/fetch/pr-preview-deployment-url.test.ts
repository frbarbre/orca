import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ghExecFileAsync: vi.fn(),
  resolveGitHubRepoExecution: vi.fn(),
  repositoryRateLimitGuard: vi.fn()
}))

vi.mock('../../gh-utils', () => ({
  ghExecFileAsync: mocks.ghExecFileAsync,
  acquire: vi.fn(async () => {}),
  release: vi.fn()
}))
vi.mock('../../github-api-repository', () => ({
  resolveGitHubRepoExecution: mocks.resolveGitHubRepoExecution
}))
vi.mock('../../rate-limit', () => ({
  repositoryRateLimitGuard: mocks.repositoryRateLimitGuard,
  noteRepositoryRateLimitSpend: vi.fn()
}))

import { getPRPreviewDeploymentUrl } from './pr-preview-deployment-url'

type Status = { state: string; environmentUrl: string | null } | null

function respondWithCommits(commits: Status[][]): void {
  mocks.ghExecFileAsync.mockResolvedValue({
    stdout: JSON.stringify({
      data: {
        repository: {
          pullRequest: {
            commits: {
              nodes: commits.map((statuses) => ({
                commit: {
                  deployments: { nodes: statuses.map((latestStatus) => ({ latestStatus })) }
                }
              }))
            }
          }
        }
      }
    }),
    stderr: ''
  })
}

describe('getPRPreviewDeploymentUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveGitHubRepoExecution.mockResolvedValue({
      ownerRepo: { owner: 'acme', repo: 'web' },
      ghOptions: { cwd: '/repo' }
    })
    mocks.repositoryRateLimitGuard.mockReturnValue({ blocked: false })
  })

  it('returns the newest successful deployment, skipping a head commit still building', async () => {
    respondWithCommits([
      [{ state: 'SUCCESS', environmentUrl: 'https://old.pages.dev' }],
      [
        { state: 'FAILURE', environmentUrl: null },
        { state: 'SUCCESS', environmentUrl: 'https://newer.pages.dev' }
      ],
      [null]
    ])

    await expect(getPRPreviewDeploymentUrl('/repo', 42)).resolves.toBe('https://newer.pages.dev')
    const argv = mocks.ghExecFileAsync.mock.calls[0][0] as string[]
    expect(argv).toEqual(expect.arrayContaining(['owner=acme', 'repo=web', 'number=42']))
  })

  it('returns null when no deployment succeeded', async () => {
    respondWithCommits([[{ state: 'FAILURE', environmentUrl: null }], []])

    await expect(getPRPreviewDeploymentUrl('/repo', 42)).resolves.toBeNull()
  })

  it('returns null when the lookup fails', async () => {
    mocks.ghExecFileAsync.mockRejectedValue(new Error('gh failed'))

    await expect(getPRPreviewDeploymentUrl('/repo', 42)).resolves.toBeNull()
  })
})
