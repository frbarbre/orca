import { describe, expect, it } from 'vitest'
import { composerFeatures } from './composer-features'

describe('composerFeatures', () => {
  it('lets a note for an agent name workspace files, with nothing uploaded', () => {
    expect(composerFeatures('agent', 'wt-1')).toEqual({
      userMentions: false,
      fileMentionWorktreeId: 'wt-1',
      fileMentionLinks: false,
      uploads: false
    })
  })

  it('lets a GitHub comment name people and workspace files, linked on GitHub, and attach files', () => {
    expect(composerFeatures('github', 'wt-1')).toEqual({
      userMentions: true,
      fileMentionWorktreeId: 'wt-1',
      fileMentionLinks: true,
      uploads: true
    })
  })

  it('gives a tracker comment neither GitHub people nor uploads', () => {
    expect(composerFeatures('tracker', 'wt-1')).toEqual({
      userMentions: false,
      fileMentionWorktreeId: null,
      fileMentionLinks: false,
      uploads: false
    })
  })

  it('names no files without a workspace', () => {
    expect(composerFeatures('agent', null).fileMentionWorktreeId).toBeNull()
  })

  it('uploads nothing from a GitHub comment outside a workspace, whose repository it cannot tell', () => {
    expect(composerFeatures('github', null)).toEqual({
      userMentions: true,
      fileMentionWorktreeId: null,
      fileMentionLinks: true,
      uploads: false
    })
  })
})
