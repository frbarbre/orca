import { describe, expect, it } from 'vitest'
import { buildCiTriagePrompt, failedChecksToTriage, parseCiTriageConfig } from './ci-triage'

describe('parseCiTriageConfig', () => {
  it('keeps the hints, trimmed, and turns a blank or missing config into the off state', () => {
    expect(parseCiTriageConfig({ hints: '  Sentry is flowbasedk.sentry.io  ' })).toEqual({
      hints: 'Sentry is flowbasedk.sentry.io'
    })
    expect(parseCiTriageConfig({ hints: '' })).toEqual({ hints: '' })
    expect(parseCiTriageConfig(undefined)).toBeNull()
    expect(parseCiTriageConfig('on')).toBeNull()
  })
})

describe('failedChecksToTriage', () => {
  it('names the completed checks that failed, in a stable order', () => {
    expect(
      failedChecksToTriage([
        { name: 'lint', status: 'completed', conclusion: 'success', url: null },
        { name: 'checks', status: 'completed', conclusion: 'failure', url: 'https://x/runs/7' },
        { name: 'build', status: 'completed', conclusion: 'timed_out', url: null },
        { name: 'e2e', status: 'in_progress', conclusion: null, url: null }
      ])
    ).toEqual([
      { name: 'build', url: null },
      { name: 'checks', url: 'https://x/runs/7' }
    ])
  })
})

describe('buildCiTriagePrompt', () => {
  it('asks the agent to judge each failure, rerun only flakes once, and use the repo hints', () => {
    const prompt = buildCiTriagePrompt({
      prNumber: 12,
      headSha: 'abc1234',
      failedChecks: [{ name: 'checks', url: 'https://github.com/acme/app/actions/runs/7' }],
      hints: 'Our Sentry is flowbasedk.sentry.io; main reports e2e failures with source:trunk.'
    })

    expect(prompt).toContain('#12')
    expect(prompt).toContain('abc1234')
    expect(prompt).toContain('checks: https://github.com/acme/app/actions/runs/7')
    expect(prompt).toContain('gh run rerun')
    expect(prompt).toContain('--failed')
    expect(prompt).toContain('run_attempt')
    expect(prompt).toContain('Our Sentry is flowbasedk.sentry.io')
    expect(prompt).toContain('Do not change any code')
  })

  it('leaves out the hints section when the repo has none', () => {
    const prompt = buildCiTriagePrompt({
      prNumber: 12,
      headSha: 'abc1234',
      failedChecks: [{ name: 'checks', url: null }],
      hints: ''
    })
    expect(prompt).not.toContain('About this repository')
  })
})
