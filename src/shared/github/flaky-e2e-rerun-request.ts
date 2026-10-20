import type { GitHubRepositoryIdentity } from './pull-request-types'

export type FlakyE2eRerunRequest = {
  repoId: string
  prNumber: number
  headSha?: string
  prRepo?: GitHubRepositoryIdentity | null
}

export type FlakyE2eRerunResult = { runId: number; rerun: boolean; reason: string }[]
