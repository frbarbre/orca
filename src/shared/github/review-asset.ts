export type ReviewAssetKind = 'image' | 'video'

export type UploadReviewAssetRequest = {
  name: string
  contentType: string
  bytes: Uint8Array
}

export type UploadReviewAssetResult =
  | { ok: true; url: string; kind: ReviewAssetKind }
  | { ok: false; error: string }

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])

export function reviewAssetKind(contentType: string): ReviewAssetKind | null {
  const type = contentType.toLowerCase()
  if (IMAGE_TYPES.has(type)) {
    return 'image'
  }
  return VIDEO_TYPES.has(type) ? 'video' : null
}

export const REVIEW_ASSET_PUBLIC_HOST = 'helios-review-assets.fsn1.your-objectstorage.com'

function reviewAssetPath(href: string | undefined): string | null {
  if (!href) {
    return null
  }
  try {
    const url = new URL(href)
    return url.protocol === 'https:' && url.hostname === REVIEW_ASSET_PUBLIC_HOST
      ? url.pathname
      : null
  } catch {
    return null
  }
}

export function isReviewAssetImageUrl(href: string | undefined): href is string {
  return /\.(png|jpe?g|gif|webp)$/i.test(reviewAssetPath(href) ?? '')
}

export function isReviewAssetVideoUrl(href: string | undefined): href is string {
  return /\.(mp4|mov|webm)$/i.test(reviewAssetPath(href) ?? '')
}
