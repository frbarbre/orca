import { describe, expect, it } from 'vitest'
import { importOnlyCandidates, withImportOnlyAttributes } from './import-only-attributes'
import { classifySourceControlFilePath } from './file-category'

describe('importOnlyCandidates', () => {
  it('asks only about small changes, since an imports-only change touches a few lines', () => {
    expect(
      importOnlyCandidates({
        'src/a.ts': { added: 2, removed: 1 },
        'src/b.py': { added: 1 },
        'src/big.ts': { added: 50, removed: 40 },
        'src/binary.png': {}
      })
    ).toEqual(['src/a.ts', 'src/b.py'])
    expect(importOnlyCandidates(undefined)).toEqual([])
  })
})

describe('withImportOnlyAttributes', () => {
  it('files the imports-only paths under "Imports only", over the type they would have', () => {
    const attributes = withImportOnlyAttributes({ 'src/a.test.ts': { 'review-test': 'set' } }, [
      'src/a.test.ts',
      'src/b.ts'
    ])

    expect(classifySourceControlFilePath('src/a.test.ts', attributes['src/a.test.ts'])).toBe(
      'imports'
    )
    expect(classifySourceControlFilePath('src/b.ts', attributes['src/b.ts'])).toBe('imports')
    expect(classifySourceControlFilePath('src/c.ts', attributes['src/c.ts'])).toBe('implementation')
  })

  it('hands back the same attributes when no file is imports-only', () => {
    const attributes = {}
    expect(withImportOnlyAttributes(attributes, [])).toBe(attributes)
  })
})
