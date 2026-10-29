import { describe, expect, it } from 'vitest'
import { isImportOnlyChange } from './import-only-change'

describe('isImportOnlyChange', () => {
  it('sees a TypeScript file whose imports moved, merged and grew as an imports-only change', () => {
    const before = [
      "import { a } from './a'",
      "import { b } from '@/shared/b'",
      '',
      'export const x = a + b'
    ].join('\n')
    const after = [
      'import {',
      '  a,',
      '  type A',
      "} from '@/entities/a'",
      "import { b } from '@/shared'",
      "export { c } from './c'",
      "export * from './d'",
      '',
      'export const x = a + b'
    ].join('\n')
    expect(isImportOnlyChange('src/x.ts', before, after)).toBe(true)
  })

  it('sees a Python file whose imports moved, wrapped and split the same way', () => {
    const before = [
      'from app.domain import Layer, Frame',
      'import os',
      '',
      'def f():',
      '    return os'
    ].join('\n')
    const after = [
      'import os',
      'from app.domain.layer import (',
      '    Layer,',
      ')',
      'from app.domain.frame import \\',
      '    Frame',
      '',
      'def f():',
      '    return os'
    ].join('\n')
    expect(isImportOnlyChange('apps/backend/x.py', before, after)).toBe(true)
  })

  it('does not when any other line changed, or nothing about the imports did', () => {
    expect(
      isImportOnlyChange('a.ts', "import { a } from 'a'\nf(a)", "import { a } from 'b'\nf(a, 1)")
    ).toBe(false)
    expect(isImportOnlyChange('a.ts', 'f(a)\n', 'f(a)\n\n')).toBe(false)
    expect(
      isImportOnlyChange('a.ts', "import { a } from 'a'\nf(a)", "import { a } from 'a'\nf(a)")
    ).toBe(false)
  })

  it('leaves files of other languages alone', () => {
    expect(isImportOnlyChange('a.go', 'import "fmt"', 'import "os"')).toBe(false)
  })
})
