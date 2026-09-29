import { describe, expect, it } from 'vitest'
import { isReviewAssetVideoUrl, reviewAssetKind, reviewAssetMarkdown } from './review-asset'

describe('review assets', () => {
  it('accepts images and videos only', () => {
    expect(reviewAssetKind('image/png')).toBe('image')
    expect(reviewAssetKind('video/quicktime')).toBe('video')
    expect(reviewAssetKind('text/html')).toBeNull()
    expect(reviewAssetKind('image/svg+xml')).toBeNull()
  })

  it('writes an image as markdown and a video as a bare link GitHub and Orca can open', () => {
    expect(reviewAssetMarkdown('image', 'a [b].png', 'https://x/a.png')).toBe(
      '![a b.png](https://x/a.png)'
    )
    expect(reviewAssetMarkdown('video', 'c.mp4', 'https://x/c.mp4')).toBe('\nhttps://x/c.mp4\n')
  })

  it('recognises videos in the review assets bucket', () => {
    expect(
      isReviewAssetVideoUrl(
        'https://helios-review-assets.fsn1.your-objectstorage.com/assets/2026/09/a.mp4'
      )
    ).toBe(true)
    expect(isReviewAssetVideoUrl('https://evil.example/assets/a.mp4')).toBe(false)
    expect(
      isReviewAssetVideoUrl('https://helios-review-assets.fsn1.your-objectstorage.com/assets/a.png')
    ).toBe(false)
  })
})
