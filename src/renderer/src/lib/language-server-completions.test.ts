import { describe, expect, it } from 'vitest'
import { toMonacoCompletion } from './language-server-completions'

const kinds = { Text: 18, Method: 0, Function: 1, Variable: 4, Class: 5, Keyword: 17 }
const wordRange = { startLineNumber: 5, startColumn: 3, endLineNumber: 5, endColumn: 5 }
const deps = { kinds, insertAsSnippet: 4, wordRange }

describe('toMonacoCompletion', () => {
  it("turns a server's snippet into a Monaco suggestion over its own range, with markdown docs", () => {
    expect(
      toMonacoCompletion(
        {
          label: 'useState',
          kind: 3,
          detail: 'function useState<S>(initial: S)',
          documentation: 'Returns a **stateful** value.',
          sortText: '11',
          filterText: 'useState',
          insertText: 'useState($1)',
          snippet: true,
          range: { line: 4, character: 2, endLine: 4, endCharacter: 6 }
        },
        deps
      )
    ).toEqual({
      label: 'useState',
      kind: 1,
      detail: 'function useState<S>(initial: S)',
      documentation: { value: 'Returns a **stateful** value.' },
      sortText: '11',
      filterText: 'useState',
      insertText: 'useState($1)',
      insertTextRules: 4,
      range: { startLineNumber: 5, startColumn: 3, endLineNumber: 5, endColumn: 7 }
    })
  })

  it('replaces the word at the cursor when the server names no range, and reads an unknown kind as text', () => {
    expect(toMonacoCompletion({ label: 'append', kind: 99, insertText: 'append' }, deps)).toEqual({
      label: 'append',
      kind: 18,
      insertText: 'append',
      range: wordRange
    })
  })

  it('shows where a name comes from beside it, and adds its import when accepted', () => {
    expect(
      toMonacoCompletion(
        {
          label: 'getLogger',
          labelDetail: ' (import logging)',
          labelDescription: 'logging',
          insertText: 'getLogger',
          additionalEdits: [
            {
              startLine: 0,
              startCharacter: 0,
              endLine: 0,
              endCharacter: 0,
              text: 'from logging import getLogger\n'
            }
          ]
        },
        deps
      )
    ).toEqual({
      label: { label: 'getLogger', detail: ' (import logging)', description: 'logging' },
      kind: 18,
      insertText: 'getLogger',
      additionalTextEdits: [
        {
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
          text: 'from logging import getLogger\n'
        }
      ],
      range: wordRange
    })
  })

  it.each([
    [2, 0],
    [6, 4],
    [7, 5],
    [14, 17]
  ])('maps LSP kind %i to Monaco kind %i', (lsp, monaco) => {
    expect(toMonacoCompletion({ label: 'x', kind: lsp, insertText: 'x' }, deps).kind).toBe(monaco)
  })
})
