import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import {
  reviewAssetKind,
  type UploadReviewAssetRequest,
  type UploadReviewAssetResult
} from '../../shared/github/review-asset'

type ReviewAssetConfig = { endpoint: string; token: string }

const SIGN_TIMEOUT_MS = 20_000
const UPLOAD_TIMEOUT_MS = 10 * 60_000

// Why a file of its own in userData: the token only unlocks upload URLs into the public bucket,
// and keeping it out of settings keeps it out of the renderer and out of synced state.
function configPath(): string {
  return join(app.getPath('userData'), 'review-assets.json')
}

async function readConfig(): Promise<ReviewAssetConfig | null> {
  try {
    const raw: unknown = JSON.parse(await readFile(configPath(), 'utf8'))
    if (raw && typeof raw === 'object' && 'endpoint' in raw && 'token' in raw) {
      const endpoint = String(raw.endpoint).replace(/\/+$/, '')
      const token = String(raw.token)
      return endpoint.startsWith('https://') && token ? { endpoint, token } : null
    }
  } catch {
    return null
  }
  return null
}

export async function isReviewAssetUploadConfigured(): Promise<boolean> {
  return (await readConfig()) !== null
}

function readError(body: unknown, fallback: string): string {
  return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
    ? body.error
    : fallback
}

export async function uploadReviewAsset(
  request: UploadReviewAssetRequest
): Promise<UploadReviewAssetResult> {
  const kind = reviewAssetKind(request.contentType)
  if (!kind) {
    return { ok: false, error: 'Only images and videos can be attached.' }
  }
  const config = await readConfig()
  if (!config) {
    return { ok: false, error: 'Asset uploads are not set up on this computer.' }
  }
  try {
    const signed = await fetch(`${config.endpoint}/v1/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: request.name,
        contentType: request.contentType,
        size: request.bytes.byteLength
      }),
      signal: AbortSignal.timeout(SIGN_TIMEOUT_MS)
    })
    const plan: unknown = await signed.json().catch(() => null)
    if (!signed.ok || !plan || typeof plan !== 'object') {
      return { ok: false, error: readError(plan, `The upload service answered ${signed.status}.`) }
    }
    const uploadUrl = 'uploadUrl' in plan ? String(plan.uploadUrl) : ''
    const publicUrl = 'publicUrl' in plan ? String(plan.publicUrl) : ''
    if (!uploadUrl.startsWith('https://') || !publicUrl.startsWith('https://')) {
      return { ok: false, error: 'The upload service returned an invalid answer.' }
    }
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': request.contentType.toLowerCase() },
      body: Buffer.from(request.bytes),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
    })
    if (!put.ok) {
      return { ok: false, error: `The upload was refused (${put.status}).` }
    }
    return { ok: true, url: publicUrl, kind }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.name === 'TimeoutError'
          ? 'The upload timed out. Are you on the tailnet?'
          : `The upload failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
