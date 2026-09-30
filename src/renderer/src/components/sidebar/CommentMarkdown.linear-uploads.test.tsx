// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CommentMarkdown from './CommentMarkdown'

const linearUpload =
  'https://uploads.linear.app/129fa113/df7365e6/ffbdf35a-1ce9-4a85-ae28-ccf20c920c9a?signature=abc.def.ghi'

let root: Root | null = null

async function render(content: string, variant?: 'document'): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<CommentMarkdown variant={variant} content={content} />)
  })
  return container
}

describe('CommentMarkdown Linear uploads', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    act(() => root?.unmount())
    root = null
    document.body.replaceChildren()
  })

  it('shows an image a Linear comment synced as an <img> tag in a compact comment', async () => {
    const mounted = await render(
      `Move this\n\n<img src="${linearUpload} " alt="image.png" width="260" />`
    )

    const image = mounted.querySelector<HTMLImageElement>('button[aria-label="Expand image"] img')
    expect(image?.getAttribute('src')?.trim()).toBe(linearUpload)
    expect(mounted.querySelector('a')).toBeNull()
  })

  it('plays a Linear video link, named by its file, as a video', async () => {
    for (const variant of [undefined, 'document'] as const) {
      const mounted = await render(`[Screen Recording.mov](${linearUpload})`, variant)

      expect(
        mounted.querySelector('button[aria-label="Play video"] video')?.getAttribute('src')
      ).toBe(linearUpload)
      act(() => root?.unmount())
      document.body.replaceChildren()
    }
  })

  it('keeps other remote images and ordinary Linear links as links', async () => {
    const mounted = await render(
      `![x](https://evil.test/pixel.png) [the issue](https://uploads.linear.app/a/b/c?signature=1)`
    )

    expect(mounted.querySelector('img')).toBeNull()
    expect([...mounted.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['x', 'the issue'])
  })
})
