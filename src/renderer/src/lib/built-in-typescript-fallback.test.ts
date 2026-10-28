import { describe, expect, it } from 'vitest'
import { completionEntriesToSuggestions, quickInfoToMarkdown } from './built-in-typescript-fallback'

describe('quickInfoToMarkdown', () => {
  it('renders the signature as a code block and the docs below it', () => {
    expect(
      quickInfoToMarkdown({
        displayParts: [
          { text: 'const' },
          { text: ' ' },
          { text: 'collisionMessage' },
          { text: ': ' },
          { text: 'string' }
        ],
        documentation: [{ text: 'Shown when the identifier is taken.' }]
      })
    ).toBe(
      '```typescript\nconst collisionMessage: string\n```\n\nShown when the identifier is taken.'
    )
  })

  it('has nothing when the worker knows nothing', () => {
    expect(quickInfoToMarkdown(undefined)).toBeNull()
    expect(quickInfoToMarkdown({ displayParts: [] })).toBeNull()
  })
})

describe('completionEntriesToSuggestions', () => {
  const kinds = { Method: 0, Function: 1, Variable: 4, Class: 5, Property: 9, Keyword: 17 }
  const wordRange = { startLineNumber: 2, startColumn: 5, endLineNumber: 2, endColumn: 7 }

  it("offers the worker's names over the word at the cursor, kinds and order kept", () => {
    expect(
      completionEntriesToSuggestions(
        [
          { name: 'push', kind: 'method', sortText: '11' },
          { name: 'length', kind: 'property', sortText: '11' },
          { name: 'count', kind: 'const', sortText: '12', insertText: 'count' },
          { name: 'return', kind: 'keyword', sortText: '15' },
          { name: 'odd', kind: 'something new', sortText: '16' }
        ],
        kinds,
        wordRange
      )
    ).toEqual([
      { label: 'push', kind: 0, sortText: '11', insertText: 'push', range: wordRange },
      { label: 'length', kind: 9, sortText: '11', insertText: 'length', range: wordRange },
      { label: 'count', kind: 4, sortText: '12', insertText: 'count', range: wordRange },
      { label: 'return', kind: 17, sortText: '15', insertText: 'return', range: wordRange },
      { label: 'odd', kind: 9, sortText: '16', insertText: 'odd', range: wordRange }
    ])
  })
})
