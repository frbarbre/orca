import { describe, expect, it } from 'vitest'
import {
  decideFlakyE2eRerun,
  parseFlakyE2eRerunConfig,
  playwrightFailedTests,
  renderSentryIssueQuery
} from './flaky-e2e-rerun'

const report = {
  suites: [
    {
      specs: [
        {
          title: 'drags a layer',
          file: 'e2e/tests/layers.spec.ts',
          tests: [{ status: 'unexpected' }]
        },
        {
          title: 'opens the editor',
          file: 'e2e/tests/editor.spec.ts',
          tests: [{ status: 'flaky' }]
        }
      ],
      suites: [
        {
          specs: [
            {
              title: 'saves the brand kit',
              file: 'e2e/tests/brand-kit.spec.ts',
              tests: [{ status: 'expected' }, { status: 'unexpected' }]
            }
          ]
        }
      ]
    }
  ]
}

const LAYERS = { title: 'drags a layer', file: 'e2e/tests/layers.spec.ts' }
const BRAND_KIT = { title: 'saves the brand kit', file: 'e2e/tests/brand-kit.spec.ts' }

describe('playwrightFailedTests', () => {
  it('lists the tests that failed every attempt, in nested suites too', () => {
    expect(playwrightFailedTests(report)).toEqual([LAYERS, BRAND_KIT])
  })

  it('finds nothing in something that is not a report', () => {
    expect(playwrightFailedTests({ message: 'Not Found' })).toEqual([])
    expect(playwrightFailedTests(null)).toEqual([])
  })
})

describe('renderSentryIssueQuery', () => {
  it('fills the template with the quoted test file and title', () => {
    expect(
      renderSentryIssueQuery('is:unresolved test_file:{file} test_title:{title}', {
        title: 'says "hi" \\ bye',
        file: 'e2e/a.spec.ts'
      })
    ).toBe('is:unresolved test_file:"e2e/a.spec.ts" test_title:"says \\"hi\\" \\\\ bye"')
  })
})

describe('parseFlakyE2eRerunConfig', () => {
  it('reads a complete config and refuses one missing what the lookup needs', () => {
    const config = {
      sentryUrl: 'https://de.sentry.io/',
      sentryOrg: 'flowbasedk',
      sentryProjectIds: ['11', ' 22 ', ''],
      reportArtifact: 'e2e-report',
      reportFile: 'results.json',
      queryTemplate: 'test_file:{file} test_title:{title}'
    }
    expect(parseFlakyE2eRerunConfig(config)).toEqual({
      ...config,
      sentryUrl: 'https://de.sentry.io',
      sentryProjectIds: ['11', '22']
    })
    expect(parseFlakyE2eRerunConfig({ ...config, sentryOrg: ' ' })).toBeNull()
    expect(parseFlakyE2eRerunConfig({ ...config, sentryProjectIds: [] })).toBeNull()
    expect(parseFlakyE2eRerunConfig(undefined)).toBeNull()
  })
})

describe('decideFlakyE2eRerun', () => {
  it('reruns when every failed e2e test is a known flake on main', () => {
    expect(
      decideFlakyE2eRerun({ attempt: 1, failedTests: [LAYERS, BRAND_KIT], unknownTests: [] })
    ).toEqual({ rerun: true, reason: 'Every failed e2e test already fails on main.' })
  })

  it('keeps the failure for a test new to main, an empty report, or a run already rerun', () => {
    expect(
      decideFlakyE2eRerun({
        attempt: 1,
        failedTests: [LAYERS, BRAND_KIT],
        unknownTests: [BRAND_KIT]
      })
    ).toEqual({
      rerun: false,
      reason: 'Not failing on main: e2e/tests/brand-kit.spec.ts › saves the brand kit'
    })
    expect(decideFlakyE2eRerun({ attempt: 1, failedTests: [], unknownTests: [] }).rerun).toBe(false)
    expect(decideFlakyE2eRerun({ attempt: 2, failedTests: [LAYERS], unknownTests: [] }).rerun).toBe(
      false
    )
  })
})
