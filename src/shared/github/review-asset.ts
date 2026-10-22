import type { GitHubRepositoryIdentity } from './pull-request-types'

export type ReviewAssetKind = 'image' | 'video'

export type UploadReviewAssetRequest = {
  name: string
  contentType: string
  bytes: Uint8Array
  repo: GitHubRepositoryIdentity
}

export type UploadReviewAssetResult =
  | { ok: true; url: string; kind: ReviewAssetKind }
  | { ok: false; error: string }

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])

// Why these numbers: GitHub's own attachment limits; a larger file is refused only after the whole
// upload, so it is cheaper to say so first.
export const REVIEW_ASSET_MAX_BYTES: Record<ReviewAssetKind, number> = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024
}

export function reviewAssetKind(contentType: string): ReviewAssetKind | null {
  const type = contentType.toLowerCase()
  if (IMAGE_TYPES.has(type)) {
    return 'image'
  }
  return VIDEO_TYPES.has(type) ? 'video' : null
}

const GITHUB_ATTACHMENT_URL = /^https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]{36}$/i

export function isGitHubAttachmentAssetUrl(href: string | undefined): href is string {
  return typeof href === 'string' && GITHUB_ATTACHMENT_URL.test(href)
}

const REPO_NAME_PART = /^[A-Za-z0-9_.-]+$/
const IMAGE_FILE_NAME = /\.(png|jpe?g|gif|webp)$/i

/** A repository file linked from github.com: its owner, repo, and the ref and path run together. */
export type GitHubRepoFileImage = { owner: string; repo: string; refAndPath: string[] }

/**
 * Fork: `github.com/<owner>/<repo>/raw/<ref>/<path>` or `.../blob/<ref>/<path>?raw=true` naming an
 * image. The ref and path are one run of segments, since a branch name may itself hold slashes.
 */
export function parseGitHubRepoFileImageUrl(href: string | undefined): GitHubRepoFileImage | null {
  if (!href) {
    return null
  }
  let url: URL
  let segments: string[]
  try {
    url = new URL(href)
    segments = url.pathname.split('/').slice(1).map(decodeURIComponent)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.port) {
    return null
  }
  const [owner, repo, kind, ...refAndPath] = segments
  const raw = kind === 'raw' || (kind === 'blob' && url.searchParams.get('raw') === 'true')
  if (
    !owner ||
    !repo ||
    !raw ||
    !REPO_NAME_PART.test(owner) ||
    !REPO_NAME_PART.test(repo) ||
    refAndPath.length < 2 ||
    refAndPath.some((segment) => !segment || segment === '..') ||
    !IMAGE_FILE_NAME.test(refAndPath.at(-1) ?? '')
  ) {
    return null
  }
  return { owner, repo, refAndPath }
}

/** Images GitHub serves only to a signed-in viewer, so the renderer shows a signed URL for them. */
export function isGitHubSignedImageUrl(href: string | undefined): href is string {
  return isGitHubAttachmentAssetUrl(href) || parseGitHubRepoFileImageUrl(href) !== null
}
