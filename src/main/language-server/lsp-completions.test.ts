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

  it('reads the source a name is imported from and the import edit accepting it adds', () => {
    expect(
      readCompletions([
        {
          label: 'getLogger',
          labelDetails: { description: 'logging', detail: ' (import logging)' },
          additionalTextEdits: [
            {
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
              newText: 'from logging import getLogger\n'
            }
          ]
        }
      ]).items
    ).toEqual([
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
      }
    ])
  })

  it('numbers each item within its list, so the server can fill it in later', () => {
    expect(
      readCompletions([{ kind: 6 }, { label: 'useState' }, { label: 'useEffect' }], 7).items
    ).toEqual([
      { label: 'useState', insertText: 'useState', resolve: { list: 7, index: 1 } },
      { label: 'useEffect', insertText: 'useEffect', resolve: { list: 7, index: 2 } }
    ])
  })

  it('reads nothing from an empty answer', () => {
    expect(readCompletions(null)).toEqual({ incomplete: false, items: [] })
  })
})
