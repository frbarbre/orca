import { describe, expect, it } from 'vitest'
import {
  classifySourceControlFilePath,
  collectSourceControlFileCategories,
  filterSourceControlPathEntriesByCategory
} from './file-category'

describe('classifySourceControlFilePath without .gitattributes', () => {
  it.each([
    'apps/frontend/src/button.test.tsx',
    'apps/frontend/src/button.spec.ts',
    'apps/frontend/e2e/editor/layers.ts',
    'apps/backend/tests/conftest.py',
    'pkg/server/handler_test.go'
  ])('treats %s as a test', (path) => {
    expect(classifySourceControlFilePath(path)).toBe('test')
  })

  it.each([
    'apps/frontend/src/generated/api.ts',
    'pnpm-lock.yaml',
    'apps/frontend/package-lock.json',
    'Cargo.lock'
  ])('treats %s as generated', (path) => {
    expect(classifySourceControlFilePath(path)).toBe('generated')
  })

  it.each(['apps/frontend/src/button.tsx', 'apps/backend/app/latest.py'])(
    'treats %s as implementation',
    (path) => {
      expect(classifySourceControlFilePath(path)).toBe('implementation')
    }
  )
})

describe('classifySourceControlFilePath with .gitattributes', () => {
  it('assigns a category the path heuristic cannot see', () => {
    expect(
      classifySourceControlFilePath('apps/backend/api/types/_generated/user.py', {
        'linguist-generated': 'set'
      })
    ).toBe('generated')
    expect(classifySourceControlFilePath('docs/guide.md', { 'review-documentation': 'set' })).toBe(
      'documentation'
    )
    expect(classifySourceControlFilePath('AGENTS.md', { 'review-agent-guidance': 'set' })).toBe(
      'agent-guidance'
    )
  })

  it('lets a review-* attribute win over a linguist-* one', () => {
    expect(
      classifySourceControlFilePath('fixtures/a.ts', {
        'linguist-generated': 'set',
        'review-test': 'set'
      })
    ).toBe('test')
  })

  it('removes a heuristic category when the attribute is unset', () => {
    expect(
      classifySourceControlFilePath('tests/button.stories.tsx', { 'review-test': 'unset' })
    ).toBe('implementation')
    expect(
      classifySourceControlFilePath('src/generated/handwritten.ts', {
        'linguist-generated': 'unset'
      })
    ).toBe('implementation')
  })

  it('keeps the heuristic when an unrelated category is unset', () => {
    expect(classifySourceControlFilePath('tests/a.ts', { 'review-generated': 'unset' })).toBe(
      'test'
    )
  })
})

describe('collectSourceControlFileCategories', () => {
  it('lists only the categories present across every list, in a fixed order', () => {
    expect(
      collectSourceControlFileCategories(
        [[{ path: 'pnpm-lock.yaml' }], [], [{ path: 'src/a.ts' }, { path: 'docs/a.md' }]],
        { 'docs/a.md': { 'review-documentation': 'set' } }
      )
    ).toEqual(['implementation', 'documentation', 'generated'])
  })
})

describe('filterSourceControlPathEntriesByCategory', () => {
  const entries = [{ path: 'src/a.ts' }, { path: 'src/a.test.ts' }, { path: 'yarn.lock' }]

  it('returns the same array when nothing is hidden', () => {
    expect(filterSourceControlPathEntriesByCategory(entries, new Set(), {})).toBe(entries)
  })

  it('drops entries in hidden categories', () => {
    expect(
      filterSourceControlPathEntriesByCategory(entries, new Set(['test', 'generated']), {})
    ).toEqual([{ path: 'src/a.ts' }])
  })

  it('classifies with .gitattributes when filtering', () => {
    expect(
      filterSourceControlPathEntriesByCategory(entries, new Set(['generated']), {
        'yarn.lock': { 'linguist-generated': 'unset' }
      })
    ).toEqual(entries)
  })
})
