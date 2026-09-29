import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dir = mkdtempSync(join(tmpdir(), 'orca-review-assets-'))
vi.mock('electron', () => ({ app: { getPath: () => dir } }))

import { isReviewAssetUploadConfigured, uploadReviewAsset } from './review-asset-upload'

const bytes = new Uint8Array([1, 2, 3])

describe('uploadReviewAsset', () => {
  beforeEach(() => {
    rmSync(join(dir, 'review-assets.json'), { force: true })
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is off until the config file exists', async () => {
    expect(await isReviewAssetUploadConfigured()).toBe(false)
    expect(await uploadReviewAsset({ name: 'a.png', contentType: 'image/png', bytes })).toEqual({
      ok: false,
      error: 'Asset uploads are not set up on this computer.'
    })
  })

  it('signs with the token, uploads the bytes, and returns the public link', async () => {
    writeFileSync(
      join(dir, 'review-assets.json'),
      JSON.stringify({ endpoint: 'https://signer.test/', token: 't0ken' })
    )
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uploadUrl: 'https://bucket.test/a?sig',
            publicUrl: 'https://bucket.test/a'
          })
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await uploadReviewAsset({ name: 'a.png', contentType: 'image/png', bytes })

    expect(result).toEqual({ ok: true, url: 'https://bucket.test/a', kind: 'image' })
    const [signUrl, signInit] = fetchMock.mock.calls[0] ?? []
    expect(signUrl).toBe('https://signer.test/v1/uploads')
    expect(signInit?.headers).toMatchObject({ authorization: 'Bearer t0ken' })
    expect(JSON.parse(String(signInit?.body))).toEqual({
      filename: 'a.png',
      contentType: 'image/png',
      size: 3
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://bucket.test/a?sig')
  })

  it("passes on the signer's reason when it refuses", async () => {
    writeFileSync(
      join(dir, 'review-assets.json'),
      JSON.stringify({ endpoint: 'https://signer.test', token: 't' })
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Files of this type must be at most 200 MB.' }), {
        status: 400
      })
    )
    expect(await uploadReviewAsset({ name: 'b.mp4', contentType: 'video/mp4', bytes })).toEqual({
      ok: false,
      error: 'Files of this type must be at most 200 MB.'
    })
  })

  it('refuses anything that is not an image or a video before calling out', async () => {
    expect(await uploadReviewAsset({ name: 'x.html', contentType: 'text/html', bytes })).toEqual({
      ok: false,
      error: 'Only images and videos can be attached.'
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
