import { describe, expect, it } from 'vitest'
import { isReviewAssetImageUrl, isReviewAssetVideoUrl, reviewAssetKind } from './review-asset'

describe('review assets', () => {
  it('accepts images and videos only', () => {
    expect(reviewAssetKind('image/png')).toBe('image')
    expect(reviewAssetKind('video/quicktime')).toBe('video')
    expect(reviewAssetKind('text/html')).toBeNull()
    expect(reviewAssetKind('image/svg+xml')).toBeNull()
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

  it('recognises images in the review assets bucket, and nothing hosted elsewhere', () => {
    const bucket = 'https://helios-review-assets.fsn1.your-objectstorage.com/assets/2026/09'
    expect(isReviewAssetImageUrl(`${bucket}/a.png`)).toBe(true)
    expect(isReviewAssetImageUrl(`${bucket}/a.mp4`)).toBe(false)
    expect(isReviewAssetImageUrl('https://evil.example/assets/a.png')).toBe(false)
    expect(
      isReviewAssetImageUrl(`http://helios-review-assets.fsn1.your-objectstorage.com/a.png`)
    ).toBe(false)
  })
})
