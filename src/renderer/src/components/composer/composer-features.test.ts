import { describe, expect, it } from 'vitest'
import { composerFeatures } from './composer-features'

describe('composerFeatures', () => {
  it('lets a note for an agent name workspace files, with nothing uploaded', () => {
    expect(composerFeatures('agent', 'wt-1')).toEqual({
      userMentions: false,
      fileMentionWorktreeId: 'wt-1',
      uploads: false
    })
  })

  it('lets a GitHub comment name people and attach files', () => {
    expect(composerFeatures('github', 'wt-1')).toEqual({
      userMentions: true,
      fileMentionWorktreeId: null,
      uploads: true
    })
  })

  it('gives a tracker comment neither GitHub people nor uploads', () => {
    expect(composerFeatures('tracker', 'wt-1')).toEqual({
      userMentions: false,
      fileMentionWorktreeId: null,
      uploads: false
    })
  })

  it('names no files without a workspace', () => {
    expect(composerFeatures('agent', null).fileMentionWorktreeId).toBeNull()
  })
})
