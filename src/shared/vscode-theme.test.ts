import { describe, expect, it } from 'vitest'
import { parseJsonc, toMonacoTheme } from './vscode-theme'

describe('parseJsonc', () => {
  it('strips line and block comments and trailing commas', () => {
    const raw = `{
      // a line comment
      "name": "T", /* block */
      "colors": { "editor.background": "#181818", },
    }`
    expect(parseJsonc(raw)).toEqual({ name: 'T', colors: { 'editor.background': '#181818' } })
  })

  it('leaves comment-like text inside strings alone', () => {
    // Why: scopes and URLs contain "//", and stripping inside a string truncates the value.
    const raw = '{ "a": "http://x//y", "b": "/* not a comment */" }'
    expect(parseJsonc(raw)).toEqual({ a: 'http://x//y', b: '/* not a comment */' })
  })

  it('does not mistake an escaped quote for the end of a string', () => {
    expect(parseJsonc('{ "a": "he said \\"hi\\" // x" }')).toEqual({ a: 'he said "hi" // x' })
  })
})

describe('toMonacoTheme', () => {
  it('passes colours through under the same keys', () => {
    const theme = toMonacoTheme({
      type: 'dark',
      colors: {
        'editor.background': '#181818',
        'diffEditor.insertedLineBackground': '#3FA26633'
      }
    })
    expect(theme?.colors).toEqual({
      'editor.background': '#181818',
      'diffEditor.insertedLineBackground': '#3FA26633'
    })
    expect(theme?.base).toBe('vs-dark')
  })

  it('drops colours Monaco would throw on rather than failing the whole theme', () => {
    const theme = toMonacoTheme({
      colors: { 'editor.background': 'not-a-color', 'editor.foreground': '#F0F0F0' }
    })
    expect(theme?.colors).toEqual({ 'editor.foreground': '#F0F0F0' })
  })

  it('expands a scope list into one rule per scope, without the leading #', () => {
    const theme = toMonacoTheme({
      tokenColors: [
        {
          scope: ['comment', 'punctuation.definition.comment'],
          settings: { foreground: '#6D6D6D' }
        }
      ]
    })
    expect(theme?.rules).toEqual([
      { token: 'comment', foreground: '6D6D6D' },
      { token: 'punctuation.definition.comment', foreground: '6D6D6D' }
    ])
  })

  it('accepts a comma-separated scope string, which themes use interchangeably', () => {
    const theme = toMonacoTheme({
      tokenColors: [{ scope: 'keyword, storage.type', settings: { fontStyle: 'italic' } }]
    })
    expect(theme?.rules).toEqual([
      { token: 'keyword', fontStyle: 'italic' },
      { token: 'storage.type', fontStyle: 'italic' }
    ])
  })

  it('skips rules that carry no styling', () => {
    expect(toMonacoTheme({ tokenColors: [{ scope: 'x', settings: {} }] })?.rules).toEqual([])
  })

  it('picks a light base for a light theme so unstyled tokens stay readable', () => {
    expect(toMonacoTheme({ type: 'light' })?.base).toBe('vs')
    expect(toMonacoTheme({})?.base).toBe('vs-dark')
  })

  it('returns null for something that is not a theme object', () => {
    expect(toMonacoTheme('nope')).toBeNull()
    expect(toMonacoTheme(null)).toBeNull()
  })
})
