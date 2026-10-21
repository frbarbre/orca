import { describe, expect, it } from 'vitest'
import {
  buildCiTriagePrompt,
  ciTriageInstructions,
  DEFAULT_CI_TRIAGE_INSTRUCTIONS,
  failedChecksToTriage,
  parseCiTriageConfig
} from './ci-triage'

describe('parseCiTriageConfig', () => {
  it('keeps an edited prompt, trimmed, and stores the default or a blank as no prompt', () => {
    expect(parseCiTriageConfig({ prompt: '  Rerun everything once.  ' })).toEqual({
      prompt: 'Rerun everything once.'
    })
    expect(parseCiTriageConfig({ prompt: '' })).toEqual({})
    expect(parseCiTriageConfig({ prompt: DEFAULT_CI_TRIAGE_INSTRUCTIONS })).toEqual({})
    expect(parseCiTriageConfig({})).toEqual({})
  })

  it('carries hints saved before the prompt was editable into the prompt', () => {
    expect(parseCiTriageConfig({ hints: 'Our Sentry is flowbasedk.sentry.io.' })).toEqual({
      prompt: `${DEFAULT_CI_TRIAGE_INSTRUCTIONS}\n\nAbout this repository:\nOur Sentry is flowbasedk.sentry.io.`
    })
    expect(parseCiTriageConfig({ hints: '' })).toEqual({})
  })

  it('turns a missing or malformed config into the off state', () => {
    expect(parseCiTriageConfig(undefined)).toBeNull()
    expect(parseCiTriageConfig('on')).toBeNull()
  })
})

describe('ciTriageInstructions', () => {
  it('is the edited prompt, else the default with any older hints, else the default', () => {
    expect(ciTriageInstructions({ prompt: 'Rerun everything once.' })).toBe(
      'Rerun everything once.'
    )
    expect(ciTriageInstructions({ hints: 'Sentry is flowbasedk.' })).toContain(
      'About this repository:\nSentry is flowbasedk.'
    )
    expect(ciTriageInstructions({})).toBe(DEFAULT_CI_TRIAGE_INSTRUCTIONS)
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

describe('DEFAULT_CI_TRIAGE_INSTRUCTIONS', () => {
  it('reruns noise once, and fixes and pushes what has a clear fix, including broken tests', () => {
    expect(DEFAULT_CI_TRIAGE_INSTRUCTIONS).toContain('gh run rerun <run id> --failed')
    expect(DEFAULT_CI_TRIAGE_INSTRUCTIONS).toContain('run_attempt')
    expect(DEFAULT_CI_TRIAGE_INSTRUCTIONS).toContain('git merge origin/main')
    expect(DEFAULT_CI_TRIAGE_INSTRUCTIONS).toContain('a test the change broke')
    expect(DEFAULT_CI_TRIAGE_INSTRUCTIONS).toContain('git push')
    expect(DEFAULT_CI_TRIAGE_INSTRUCTIONS).toContain('Never force-push')
    expect(DEFAULT_CI_TRIAGE_INSTRUCTIONS).toContain('Fixed: <what>')
  })
})

describe('buildCiTriagePrompt', () => {
  it('names the PR, commit and failed checks, then follows the instructions', () => {
    const prompt = buildCiTriagePrompt({
      prNumber: 12,
      headSha: 'abc1234',
      failedChecks: [{ name: 'checks', url: 'https://github.com/acme/app/actions/runs/7' }],
      instructions: 'Rerun everything once.'
    })

    expect(prompt).toBe(
      'CI failed on pull request #12 at abc1234. Failed checks:\n- checks: https://github.com/acme/app/actions/runs/7\n\nRerun everything once.'
    )
  })
})
