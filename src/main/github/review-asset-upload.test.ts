import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../updater-release-api-token', () => ({
  resolveReleaseApiToken: vi.fn(() => Promise.resolve({ token: 't0ken', rateLimitScope: 'x' }))
}))

import { resolveGitHubAttachmentUrl, uploadReviewAsset } from './review-asset-upload'

const bytes = new Uint8Array([1, 2, 3])
const repo = { owner: 'acme', repo: 'widgets' }
const assetId = '4d400186-c984-470b-b03f-2a44d5d034c5'
const assetUrl = `https://github.com/user-attachments/assets/${assetId}`

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('uploadReviewAsset', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('uploads the bytes as an attachment on the repository and returns its link', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(json({ id: 42, permissions: { push: true } }))
      .mockResolvedValueOnce(json({ url: assetUrl }, 201))

    expect(
      await uploadReviewAsset({ name: 'shot one.png', contentType: 'image/png', bytes, repo })
    ).toEqual({ ok: true, url: assetUrl, kind: 'image' })

    const [lookupUrl, lookup] = fetchMock.mock.calls[0] ?? []
    expect(String(lookupUrl)).toBe('https://api.github.com/repos/acme/widgets')
    expect(lookup?.headers).toMatchObject({ authorization: 'Bearer t0ken' })
    const [uploadUrl, upload] = fetchMock.mock.calls[1] ?? []
    const sent = new URL(String(uploadUrl))
    expect(sent.origin + sent.pathname).toBe('https://uploads.github.com/user-attachments/assets')
    expect(Object.fromEntries(sent.searchParams)).toEqual({
      name: 'shot one.png',
      content_type: 'image/png',
      repository_id: '42'
    })
    expect(upload?.method).toBe('POST')
    expect(upload?.headers).toMatchObject({ 'content-type': 'application/octet-stream' })
  })

  it('refuses without write access, before sending the file', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(json({ id: 7, permissions: { push: false } }))

    expect(
      await uploadReviewAsset({
        name: 'a.png',
        contentType: 'image/png',
        bytes,
        repo: { owner: 'acme', repo: 'read-only' }
      })
    ).toEqual({ ok: false, error: 'Attaching files needs write access to acme/read-only.' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refuses a file type or size GitHub will not take, and an odd repository name', async () => {
    expect(
      await uploadReviewAsset({ name: 'a.html', contentType: 'text/html', bytes, repo })
    ).toMatchObject({ ok: false })
    expect(
      await uploadReviewAsset({
        name: 'a.png',
        contentType: 'image/png',
        bytes: new Uint8Array(10 * 1024 * 1024 + 1),
        repo
      })
    ).toEqual({ ok: false, error: 'GitHub takes images up to 10 MB.' })
    expect(
      await uploadReviewAsset({
        name: 'a.png',
        contentType: 'image/png',
        bytes,
        repo: { owner: 'acme/../x', repo: 'widgets' }
      })
    ).toEqual({ ok: false, error: 'The repository name is not valid.' })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('resolveGitHubAttachmentUrl', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('follows one redirect with the token to the signed file URL, and caches it', async () => {
    const signed = 'https://github-production-user-asset-6210df.s3.amazonaws.com/1/a.mp4?sig=1'
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: signed } })
    )

    expect(await resolveGitHubAttachmentUrl(assetUrl, 1_000)).toBe(signed)
    expect(await resolveGitHubAttachmentUrl(assetUrl, 2_000)).toBe(signed)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' })
  })

  it('never sends the token anywhere but a github.com attachment link', async () => {
    expect(await resolveGitHubAttachmentUrl('https://evil.test/user-attachments/assets/x')).toBe(
      null
    )
    expect(
      await resolveGitHubAttachmentUrl(
        `https://github.com.evil.test/user-attachments/assets/${assetId}`
      )
    ).toBe(null)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('drops a redirect to a host that is not GitHub file storage', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://evil.test/a.mp4' } })
    )

    expect(
      await resolveGitHubAttachmentUrl(
        'https://github.com/user-attachments/assets/00000000-0000-0000-0000-000000000000'
      )
    ).toBe(null)
  })
})
