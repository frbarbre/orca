import { describe, expect, it } from 'vitest'
import { readCompletions } from './lsp-completions'

describe('readCompletions', () => {
  it('reads a completion list, its edit range, snippet format and markdown docs', () => {
    expect(
      readCompletions({
        isIncomplete: true,
        items: [
          {
            label: 'useState',
            kind: 3,
            detail: 'function useState<S>(initial: S): [S, Dispatch<S>]',
            documentation: { kind: 'markdown', value: 'Returns a **stateful** value.' },
            sortText: '11',
            filterText: 'useState',
            insertTextFormat: 2,
            textEdit: {
              range: { start: { line: 4, character: 2 }, end: { line: 4, character: 6 } },
              newText: 'useState($1)'
            }
          }
        ]
      })
    ).toEqual({
      incomplete: true,
      items: [
        {
          label: 'useState',
          kind: 3,
          detail: 'function useState<S>(initial: S): [S, Dispatch<S>]',
          documentation: 'Returns a **stateful** value.',
          sortText: '11',
          filterText: 'useState',
          insertText: 'useState($1)',
          snippet: true,
          range: { line: 4, character: 2, endLine: 4, endCharacter: 6 }
        }
      ]
    })
  })

  it('reads a bare array, falling back to the label as the inserted text', () => {
    expect(readCompletions([{ label: 'append', kind: 2, documentation: 'Add an item.' }])).toEqual({
      incomplete: false,
      items: [{ label: 'append', kind: 2, documentation: 'Add an item.', insertText: 'append' }]
    })
  })

  it('takes the insert range of an insert-or-replace edit and skips items without a label', () => {
    expect(
      readCompletions([
        {
          label: 'items',
          insertText: 'items',
          textEdit: {
            insert: { start: { line: 0, character: 4 }, end: { line: 0, character: 6 } },
            replace: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } },
            newText: 'items'
          }
        },
        { kind: 6 }
      ])
    ).toEqual({
      incomplete: false,
      items: [
        {
          label: 'items',
          insertText: 'items',
          range: { line: 0, character: 4, endLine: 0, endCharacter: 6 }
        }
      ]
    })
  })

  it('reads nothing from an empty answer', () => {
    expect(readCompletions(null)).toEqual({ incomplete: false, items: [] })
  })
})
