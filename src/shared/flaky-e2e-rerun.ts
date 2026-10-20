export type FlakyE2eRerunConfig = {
  sentryUrl: string
  sentryOrg: string
  sentryProjectIds: string[]
  /** The CI artifact holding the Playwright JSON report, and the report's path inside it. */
  reportArtifact: string
  reportFile: string
  /** Sentry search for one test main reported; `{file}` and `{title}` are filled in, quoted. */
  queryTemplate: string
}

export type FailedE2eTest = { title: string; file: string }

export type FlakyE2eRerunVerdict = { rerun: boolean; reason: string }

type PlaywrightSuite = {
  specs?: { title?: unknown; file?: unknown; tests?: { status?: unknown }[] }[]
  suites?: PlaywrightSuite[]
}

function failedInSuite(suite: PlaywrightSuite): FailedE2eTest[] {
  const failed: FailedE2eTest[] = []
  for (const spec of suite.specs ?? []) {
    if (
      typeof spec.title === 'string' &&
      typeof spec.file === 'string' &&
      (spec.tests ?? []).some((test) => test.status === 'unexpected')
    ) {
      failed.push({ title: spec.title, file: spec.file })
    }
  }
  for (const child of suite.suites ?? []) {
    failed.push(...failedInSuite(child))
  }
  return failed
}

/** The tests a Playwright JSON report says failed on every attempt. */
export function playwrightFailedTests(report: unknown): FailedE2eTest[] {
  if (!report || typeof report !== 'object') {
    return []
  }
  const suites = (report as { suites?: unknown }).suites
  return Array.isArray(suites)
    ? suites.flatMap((suite) => failedInSuite(suite as PlaywrightSuite))
    : []
}

function quoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function renderSentryIssueQuery(template: string, test: FailedE2eTest): string {
  return template.replace(/\{file\}/g, quoted(test.file)).replace(/\{title\}/g, quoted(test.title))
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** A repo's flaky-rerun config, or null when it lacks anything the lookup needs. */
export function parseFlakyE2eRerunConfig(value: unknown): FlakyE2eRerunConfig | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  const config: FlakyE2eRerunConfig = {
    sentryUrl: text(record.sentryUrl).replace(/\/+$/, ''),
    sentryOrg: text(record.sentryOrg),
    sentryProjectIds: Array.isArray(record.sentryProjectIds)
      ? record.sentryProjectIds.map(text).filter(Boolean)
      : [],
    reportArtifact: text(record.reportArtifact),
    reportFile: text(record.reportFile),
    queryTemplate: text(record.queryTemplate)
  }
  const complete =
    config.sentryUrl &&
    config.sentryOrg &&
    config.sentryProjectIds.length > 0 &&
    config.reportArtifact &&
    config.reportFile &&
    config.queryTemplate
  return complete ? config : null
}

/** Whether a failed run should be rerun: one automatic rerun, only for known flakes. */
export function decideFlakyE2eRerun({
  attempt,
  failedTests,
  unknownTests
}: {
  attempt: number
  failedTests: readonly FailedE2eTest[]
  unknownTests: readonly FailedE2eTest[]
}): FlakyE2eRerunVerdict {
  if (attempt > 1) {
    return { rerun: false, reason: `Attempt ${attempt} is past the one automatic rerun.` }
  }
  if (failedTests.length === 0) {
    return { rerun: false, reason: 'The e2e report names no failed test.' }
  }
  if (unknownTests.length > 0) {
    const names = unknownTests.map((test) => `${test.file} › ${test.title}`).join('; ')
    return { rerun: false, reason: `Not failing on main: ${names}` }
  }
  return { rerun: true, reason: 'Every failed e2e test already fails on main.' }
}
