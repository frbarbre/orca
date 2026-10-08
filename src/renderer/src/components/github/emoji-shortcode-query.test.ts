import { describe, expect, it } from 'vitest'
import { findEmojiShortcodeQuery, searchCommentEmoji } from './emoji-shortcode-query'

describe('findEmojiShortcodeQuery', () => {
  it('opens on a colon and two letters, at the start or after a space', () => {
    expect(findEmojiShortcodeQuery(':th')).toEqual({ query: 'th', start: 0 })
    expect(findEmojiShortcodeQuery('nice work :Thu')).toEqual({ query: 'thu', start: 10 })
    expect(findEmojiShortcodeQuery('(:+1')).toEqual({ query: '+1', start: 1 })
  })

  it('stays closed for one letter, a time, a URL or a finished shortcode', () => {
    expect(findEmojiShortcodeQuery(':t')).toBeNull()
    expect(findEmojiShortcodeQuery('at 10:30')).toBeNull()
    expect(findEmojiShortcodeQuery('https://example')).toBeNull()
    expect(findEmojiShortcodeQuery(':thumbsup: ')).toBeNull()
  })
})

describe('searchCommentEmoji', () => {
  it('finds emoji by name, best match first', () => {
    const results = searchCommentEmoji('thumbs')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.emoji).toBe('👍')
  })
})
