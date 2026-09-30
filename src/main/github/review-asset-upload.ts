import { resolveReleaseApiToken } from '../updater-release-api-token'
import type { GitHubRepositoryIdentity } from '../../shared/github/pull-request-types'
import {
  isGitHubAttachmentAssetUrl,
  REVIEW_ASSET_MAX_BYTES,
  reviewAssetKind,
  type UploadReviewAssetRequest,
  type UploadReviewAssetResult
} from '../../shared/github/review-asset'

const API_TIMEOUT_MS = 20_000
const UPLOAD_TIMEOUT_MS = 10 * 60_000
// Why under five minutes: GitHub signs the file URL for 300 seconds.
const RESOLVED_TTL_MS = 4 * 60_000
const REPO_NAME_PART = /^[A-Za-z0-9_.-]+$/
const SIGNED_HOST_SUFFIXES = ['.amazonaws.com', '.githubusercontent.com']

const repositoryIds = new Map<string, number>()
const resolvedUrls = new Map<string, { url: string; expiresAt: number }>()

function githubHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28'
  }
}

type RepositoryAccess = { id: number; canPush: boolean }

function parseRepositoryAccess(body: unknown): RepositoryAccess | null {
  if (!body || typeof body !== 'object' || !('id' in body) || typeof body.id !== 'number') {
    return null
  }
  const permissions = 'permissions' in body ? body.permissions : null
  const canPush =
    !!permissions &&
    typeof permissions === 'object' &&
    'push' in permissions &&
    permissions.push === true
  return { id: body.id, canPush }
}

function parseMessage(body: unknown): string | null {
  return body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
    ? body.message
    : null
}

function parseAssetUrl(body: unknown): string | null {
  return body && typeof body === 'object' && 'url' in body && typeof body.url === 'string'
    ? body.url
    : null
}

async function readRepositoryId(
  repo: GitHubRepositoryIdentity,
  token: string
): Promise<number | { error: string }> {
  const key = `${repo.owner}/${repo.repo}`.toLowerCase()
  const cached = repositoryIds.get(key)
  if (cached !== undefined) {
    return cached
  }
  const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(API_TIMEOUT_MS)
  })
  if (!response.ok) {
    return { error: `GitHub cannot find ${repo.owner}/${repo.repo} for your login.` }
  }
  const body: unknown = await response.json().catch(() => null)
  const access = parseRepositoryAccess(body)
  if (!access) {
    return { error: 'GitHub returned no repository id.' }
  }
  if (!access.canPush) {
    return { error: `Attaching files needs write access to ${repo.owner}/${repo.repo}.` }
  }
  repositoryIds.set(key, access.id)
  return access.id
}

function uploadRefusal(status: number, body: unknown): string {
  if (status === 404) {
    // Why: the endpoint answers 404 rather than 403 when the login cannot write to the repository.
    return 'GitHub refused the upload: attaching files needs write access to the repository.'
  }
  return `GitHub refused the upload (${parseMessage(body) ?? `status ${status}`}).`
}

export async function uploadReviewAsset(
  request: UploadReviewAssetRequest
): Promise<UploadReviewAssetResult> {
  const kind = reviewAssetKind(request.contentType)
  if (!kind) {
    return { ok: false, error: 'Only images and videos can be attached.' }
  }
  if (request.bytes.byteLength > REVIEW_ASSET_MAX_BYTES[kind]) {
    const limit = REVIEW_ASSET_MAX_BYTES[kind] / (1024 * 1024)
    return { ok: false, error: `GitHub takes ${kind}s up to ${limit} MB.` }
  }
  if (!REPO_NAME_PART.test(request.repo.owner) || !REPO_NAME_PART.test(request.repo.repo)) {
    return { ok: false, error: 'The repository name is not valid.' }
  }
  const token = (await resolveReleaseApiToken())?.token
  if (!token) {
    return { ok: false, error: 'Sign in to GitHub with gh auth login to attach files.' }
  }
  try {
    const repositoryId = await readRepositoryId(request.repo, token)
    if (typeof repositoryId !== 'number') {
      return { ok: false, error: repositoryId.error }
    }
    const url = new URL('https://uploads.github.com/user-attachments/assets')
    url.searchParams.set('name', request.name)
    url.searchParams.set('content_type', request.contentType.toLowerCase())
    url.searchParams.set('repository_id', String(repositoryId))
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...githubHeaders(token), 'content-type': 'application/octet-stream' },
      body: Buffer.from(request.bytes),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      return { ok: false, error: uploadRefusal(response.status, body) }
    }
    const assetUrl = parseAssetUrl(body)
    if (!assetUrl?.startsWith('https://github.com/user-attachments/')) {
      return { ok: false, error: 'GitHub returned no attachment link.' }
    }
    return { ok: true, url: assetUrl, kind }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.name === 'TimeoutError'
          ? 'The upload to GitHub timed out.'
          : `The upload failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

function isSignedFileUrl(location: string): boolean {
  try {
    const url = new URL(location)
    return (
      url.protocol === 'https:' &&
      SIGNED_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
    )
  } catch {
    return false
  }
}

// Why: a private repository's attachments answer 404 without a github.com session, so the renderer
// shows the short-lived signed file URL GitHub redirects the token to instead.
export async function resolveGitHubAttachmentUrl(
  href: string,
  now: number = Date.now()
): Promise<string | null> {
  // Why this strict: the token goes out with the request, so it may only ever be sent to github.com.
  if (!isGitHubAttachmentAssetUrl(href)) {
    return null
  }
  const cached = resolvedUrls.get(href)
  if (cached && cached.expiresAt > now) {
    return cached.url
  }
  const token = (await resolveReleaseApiToken())?.token
  if (!token) {
    return null
  }
  try {
    const response = await fetch(href, {
      headers: { authorization: `Bearer ${token}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(API_TIMEOUT_MS)
    })
    const location = response.headers.get('location')
    if (
      response.status < 300 ||
      response.status >= 400 ||
      !location ||
      !isSignedFileUrl(location)
    ) {
      return null
    }
    resolvedUrls.set(href, { url: location, expiresAt: now + RESOLVED_TTL_MS })
    return location
  } catch {
    return null
  }
}
