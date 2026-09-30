import { describe, expect, it } from 'vitest'
import { isGitHubAttachmentAssetUrl, reviewAssetKind } from './review-asset'

describe('review assets', () => {
  it('accepts images and videos only', () => {
    expect(reviewAssetKind('image/png')).toBe('image')
    expect(reviewAssetKind('video/quicktime')).toBe('video')
    expect(reviewAssetKind('text/html')).toBeNull()
    expect(reviewAssetKind('image/svg+xml')).toBeNull()
  })

  it('recognises GitHub attachment asset links and nothing that only looks like one', () => {
    const id = '4d400186-c984-470b-b03f-2a44d5d034c5'
    expect(isGitHubAttachmentAssetUrl(`https://github.com/user-attachments/assets/${id}`)).toBe(
      true
    )
    expect(isGitHubAttachmentAssetUrl(`http://github.com/user-attachments/assets/${id}`)).toBe(
      false
    )
    expect(
      isGitHubAttachmentAssetUrl(`https://github.com.evil.test/user-attachments/assets/${id}`)
    ).toBe(false)
    expect(isGitHubAttachmentAssetUrl(`https://github.com/user-attachments/assets/${id}/x`)).toBe(
      false
    )
  })
})
