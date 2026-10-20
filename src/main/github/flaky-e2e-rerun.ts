import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  decideFlakyE2eRerun,
  playwrightFailedTests,
  renderSentryIssueQuery,
  type FailedE2eTest,
  type FlakyE2eRerunConfig
} from '../../shared/flaky-e2e-rerun'
import { acquire, ghExecFileAsync, release, type LocalGitExecOptions } from './gh-utils'
import { resolveGitHubRepoExecution, type GitHubApiRepository } from './github-api-repository'
import { getPRChecks } from './client/check/get-pr-checks'
import { parseActionsRunId } from './client/check/check-detail-field-mapping'

export type FlakyE2eRerunOutcome = { runId: number; rerun: boolean; reason: string }

export type FlakyE2eRerunDeps = {
  failedRuns: () => Promise<{ runId: number; attempt: number }[]>
  downloadReport: (runId: number) => Promise<unknown>
  isKnownOnTrunk: (test: FailedE2eTest) => Promise<boolean>
  rerunFailedJobs: (runId: number) => Promise<void>
}

const SENTRY_LOOKBACK = '14d'

async function considerRun(
  deps: FlakyE2eRerunDeps,
  runId: number,
  attempt: number
): Promise<FlakyE2eRerunOutcome> {
  const failedTests = playwrightFailedTests(attempt > 1 ? null : await deps.downloadReport(runId))
  const unknownTests: FailedE2eTest[] = []
  try {
    for (const test of failedTests) {
      if (!(await deps.isKnownOnTrunk(test))) {
        unknownTests.push(test)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { runId, rerun: false, reason: `Sentry could not answer: ${message}` }
  }
  const verdict = decideFlakyE2eRerun({ attempt, failedTests, unknownTests })
  if (verdict.rerun) {
    await deps.rerunFailedJobs(runId)
  }
  return { runId, ...verdict }
}

/**
 * Fork: reruns a pull request's failed CI runs once when every e2e test they failed is one
 * main already reports to Sentry as flaky or failing. `considered` holds the run attempts
 * already judged, so polling the same failure never asks twice.
 */
export async function considerFlakyE2eRerun(
  deps: FlakyE2eRerunDeps,
  considered: Set<string>
): Promise<FlakyE2eRerunOutcome[]> {
  const outcomes: FlakyE2eRerunOutcome[] = []
  for (const { runId, attempt } of await deps.failedRuns()) {
    const key = `${runId}:${attempt}`
    if (considered.has(key)) {
      continue
    }
    considered.add(key)
    outcomes.push(await considerRun(deps, runId, attempt))
  }
  return outcomes
}

async function gh(args: string[], options: LocalGitExecOptions): Promise<string> {
  await acquire()
  try {
    const { stdout } = await ghExecFileAsync(args, {
      ...options,
      env: { ...process.env, GH_PROMPT_DISABLED: '1' }
    })
    return stdout
  } finally {
    release()
  }
}

export async function createFlakyE2eRerunDeps({
  repoPath,
  prNumber,
  headSha,
  prRepo,
  connectionId,
  localGitOptions,
  config,
  sentryToken
}: {
  repoPath: string
  prNumber: number
  headSha?: string
  prRepo?: GitHubApiRepository | null
  connectionId?: string | null
  localGitOptions: LocalGitExecOptions
  config: FlakyE2eRerunConfig
  sentryToken: string
}): Promise<FlakyE2eRerunDeps | null> {
  const { ownerRepo, ghOptions } = await resolveGitHubRepoExecution(
    repoPath,
    prRepo,
    connectionId,
    localGitOptions
  )
  if (!ownerRepo) {
    return null
  }
  const runs = `repos/${ownerRepo.owner}/${ownerRepo.repo}/actions/runs`
  return {
    failedRuns: async () => {
      const checks = await getPRChecks(
        repoPath,
        prNumber,
        headSha,
        ownerRepo,
        { noCache: true },
        connectionId,
        localGitOptions
      )
      const runIds = new Set(
        checks
          .filter((check) => ['failure', 'timed_out'].includes(check.conclusion ?? ''))
          .map((check) => check.workflowRunId ?? parseActionsRunId(check.url))
          .filter((id): id is number => typeof id === 'number')
      )
      const failed: { runId: number; attempt: number }[] = []
      for (const runId of runIds) {
        const attempt = Number(
          (await gh(['api', `${runs}/${runId}`, '--jq', '.run_attempt'], ghOptions)).trim()
        )
        failed.push({ runId, attempt: Number.isFinite(attempt) && attempt > 0 ? attempt : 1 })
      }
      return failed
    },
    downloadReport: async (runId) => {
      const dir = await mkdtemp(join(tmpdir(), 'orca-e2e-report-'))
      try {
        await gh(
          [
            'run',
            'download',
            String(runId),
            '--repo',
            `${ownerRepo.owner}/${ownerRepo.repo}`,
            '--name',
            config.reportArtifact,
            '--dir',
            dir
          ],
          ghOptions
        )
        return JSON.parse(await readFile(join(dir, config.reportFile), 'utf8')) as unknown
      } catch {
        return null
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    },
    isKnownOnTrunk: async (test) => {
      const url = new URL(`${config.sentryUrl}/api/0/organizations/${config.sentryOrg}/issues/`)
      for (const project of config.sentryProjectIds) {
        url.searchParams.append('project', project)
      }
      url.searchParams.set('statsPeriod', SENTRY_LOOKBACK)
      url.searchParams.set('query', renderSentryIssueQuery(config.queryTemplate, test))
      const response = await fetch(url, { headers: { Authorization: `Bearer ${sentryToken}` } })
      if (!response.ok) {
        throw new Error(`Sentry answered ${response.status}`)
      }
      const issues: unknown = await response.json()
      if (!Array.isArray(issues)) {
        throw new Error('Sentry answered with something other than a list of issues')
      }
      return issues.length > 0
    },
    rerunFailedJobs: async (runId) => {
      await gh(['api', '-X', 'POST', `${runs}/${runId}/rerun-failed-jobs`], ghOptions)
    }
  }
}
