import { describe, expect, it } from 'vitest'
import { quickInfoToMarkdown } from './built-in-typescript-fallback'

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
