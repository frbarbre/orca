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

// Why a bare URL for video: GitHub strips <video> tags from comments, and a link on its own line
// is the form both GitHub and Orca turn into something you can open or play.
export function reviewAssetMarkdown(kind: ReviewAssetKind, name: string, url: string): string {
  const label = name.replace(/[[\]]/g, '')
  return kind === 'image' ? `![${label}](${url})` : `\n${url}\n`
}

export const REVIEW_ASSET_PUBLIC_HOST = 'helios-review-assets.fsn1.your-objectstorage.com'

export function isReviewAssetVideoUrl(href: string | undefined): href is string {
  if (!href) {
    return false
  }
  try {
    const url = new URL(href)
    return (
      url.protocol === 'https:' &&
      url.hostname === REVIEW_ASSET_PUBLIC_HOST &&
      /\.(mp4|mov|webm)$/i.test(url.pathname)
    )
  } catch {
    return false
  }
}
