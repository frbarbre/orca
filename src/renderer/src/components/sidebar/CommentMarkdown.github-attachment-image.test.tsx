// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CommentMarkdown from './CommentMarkdown'

const attachmentUrl =
  'https://github.com/user-attachments/assets/ce11040a-fb66-4289-927f-547b16dfc488'
const signedUrl =
  'https://github-production-user-asset-6210df.s3.amazonaws.com/1/ce11040a.png?sig=1'

let root: Root | null = null
let container: HTMLDivElement | null = null

async function renderCommentMarkdown(content: string): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<CommentMarkdown variant="document" content={content} />)
  })
  return container
}

describe('CommentMarkdown GitHub attachment images', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal('api', {
      pendingReview: { resolveAssetUrl: vi.fn(() => Promise.resolve(signedUrl)) }
    })
  })

  afterEach(() => {
    if (root) {
      act(() => root?.unmount())
    }
    document.body.replaceChildren()
    root = null
    container = null
    vi.unstubAllGlobals()
  })

  it('shows GitHub attachment images from their signed URL, and opens them full screen', async () => {
    const mounted = await renderCommentMarkdown(`![Private issue screenshot](${attachmentUrl})`)

    const trigger = mounted.querySelector<HTMLButtonElement>('button[aria-label="Expand image"]')
    const image = trigger?.querySelector<HTMLImageElement>('img')

    expect(image?.src).toBe(signedUrl)
    expect(image?.alt).toBe('Private issue screenshot')
    act(() => trigger?.click())
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('falls back to a text link when a GitHub user attachment image cannot load', async () => {
    const mounted = await renderCommentMarkdown(`![Private issue screenshot](${attachmentUrl})`)
    const image = mounted.querySelector<HTMLImageElement>(`img[src="${signedUrl}"]`)

    expect(image).not.toBeNull()
    act(() => {
      image?.dispatchEvent(new window.Event('error'))
    })

    expect(mounted.querySelector(`img[src="${signedUrl}"]`)).toBeNull()
    const fallback = mounted.querySelector<HTMLAnchorElement>(`a[href="${attachmentUrl}"]`)
    expect(fallback?.textContent).toBe('Private issue screenshot')
    expect(fallback?.className).toContain('underline')
  })

  it('plays a bare GitHub attachment link as a video from its signed URL', async () => {
    const mounted = await renderCommentMarkdown(attachmentUrl)

    expect(
      mounted.querySelector('button[aria-label="Play video"] video')?.getAttribute('src')
    ).toBe(signedUrl)
  })

  it('keeps the link when the attachment cannot be resolved', async () => {
    vi.stubGlobal('api', { pendingReview: { resolveAssetUrl: () => Promise.resolve(null) } })
    const mounted = await renderCommentMarkdown(
      '![gone](https://github.com/user-attachments/assets/00000000-0000-0000-0000-000000000001)'
    )

    expect(mounted.querySelector('img')).toBeNull()
    expect(mounted.querySelector('a')?.textContent).toBe('gone')
  })
})
