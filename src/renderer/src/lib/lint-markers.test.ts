import { describe, expect, it } from 'vitest'
import { toLintMarker } from './lint-markers'

const severity = { Hint: 1, Info: 2, Warning: 4, Error: 8 }
const parseUri = (href: string) => ({ href })

describe('toLintMarker', () => {
  it("places a finding on Monaco's one-based lines, names its linter and links its rule", () => {
    expect(
      toLintMarker(
        'oxlint',
        {
          line: 55,
          character: 4,
          endLine: 55,
          endCharacter: 15,
          severity: 2,
          code: 'eslint(no-unused-vars)',
          href: 'https://oxc.rs/no-unused-vars',
          message: "Variable 'thing' is declared but never used."
        },
        severity,
        parseUri
      )
    ).toEqual({
      startLineNumber: 56,
      startColumn: 5,
      endLineNumber: 56,
      endColumn: 16,
      severity: 4,
      source: 'oxlint',
      code: { value: 'eslint(no-unused-vars)', target: { href: 'https://oxc.rs/no-unused-vars' } },
      message: "Variable 'thing' is declared but never used."
    })
  })

  it.each([
    [1, 8],
    [3, 2],
    [4, 1]
  ] as const)('maps LSP severity %i to Monaco severity %i', (lsp, monaco) => {
    const marker = toLintMarker(
      'oxlint',
      { line: 0, character: 0, endLine: 0, endCharacter: 1, severity: lsp, message: 'x' },
      severity,
      parseUri
    )
    expect(marker.severity).toBe(monaco)
    expect(marker.code).toBeUndefined()
  })
})
