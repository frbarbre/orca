// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import React, { useRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const upload = vi.fn()

import { useReviewAssetAttachments } from './use-review-asset-attachments'

function Harness(): React.JSX.Element {
  const [value, setValue] = useState('See ')
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const attachments = useReviewAssetAttachments({ value, setValue, textareaRef: ref })
  return (
    <div>
      <textarea
        aria-label="comment"
        ref={ref}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onPaste={attachments.onPaste}
      />
      {attachments.previews}
      <button type="button" disabled={attachments.uploading}>
        Send
      </button>
    </div>
  )
}

function paste(textarea: HTMLTextAreaElement, file: File): void {
  textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  fireEvent.paste(textarea, { clipboardData: { files: [file], types: ['Files'] } })
}

describe('useReviewAssetAttachments', () => {
  beforeEach(() => {
    upload.mockReset()
    Object.assign(window, {
      api: {
        pendingReview: { uploadAsset: upload, assetUploadConfigured: () => Promise.resolve(true) }
      }
    })
    Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: vi.fn() })
  })
  afterEach(cleanup)

  it('shows the pasted image at once, holds sending, then swaps in the uploaded link', async () => {
    let finish: (value: unknown) => void = () => undefined
    upload.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    render(<Harness />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('comment')

    await act(async () => paste(textarea, new File(['png'], 'shot.png', { type: 'image/png' })))

    expect(textarea.value).toMatch(/^See !\[Uploading shot\.png…\]\(uploading:[\w-]+\)$/)
    expect(screen.getByAltText('shot.png')).toHaveAttribute('src', 'blob:preview')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    await act(async () => finish({ ok: true, kind: 'image', url: 'https://assets/x.png' }))

    expect(textarea.value).toBe('See ![shot.png](https://assets/x.png)')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  it('removes the placeholder when the upload fails', async () => {
    upload.mockResolvedValue({ ok: false, error: 'nope' })
    render(<Harness />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('comment')

    await act(async () => paste(textarea, new File(['mp4'], 'clip.mp4', { type: 'video/mp4' })))

    expect(textarea.value).toBe('See ')
  })

  it('leaves text and other files to the browser', async () => {
    render(<Harness />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('comment')
    await act(async () => paste(textarea, new File(['x'], 'notes.txt', { type: 'text/plain' })))
    expect(upload).not.toHaveBeenCalled()
  })
})
