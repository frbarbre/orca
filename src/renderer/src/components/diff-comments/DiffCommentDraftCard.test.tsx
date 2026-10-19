// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { DiffCommentDraftCard } from './DiffCommentDraftCard'
import { noteCreatedForSendFocus, takeNoteSendFocus } from './note-send-focus'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/components/composer/Composer', async () => ({
  Composer: (await import('@/components/composer/composer-test-double')).ComposerTestDouble
}))

describe('DiffCommentDraftCard', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders line header', () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(true)

    const view = render(
      <DiffCommentDraftCard lineNumber={42} onCancel={onCancel} onSubmit={onSubmit} />
    )

    expect(view.getByText('Line 42')).toBeDefined()
    expect(view.queryByText('You')).toBeNull()
    const textarea = view.getByPlaceholderText('Add note for the AI')
    expect(textarea).toBeDefined()
    expect(document.activeElement).toBe(textarea)
    expect(view.getByRole('button', { name: 'Add note' })).toBeDefined()
    expect(view.getByRole('button', { name: 'Cancel' })).toBeDefined()
  })

  it('renders range header when startLine is provided', () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(true)

    const view = render(
      <DiffCommentDraftCard
        lineNumber={42}
        startLine={38}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    )

    expect(view.getByText('Lines 38-42')).toBeDefined()
  })

  it('disables submit button when body is whitespace and enables when text is typed', () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(true)

    const view = render(
      <DiffCommentDraftCard lineNumber={10} onCancel={onCancel} onSubmit={onSubmit} />
    )

    const submitBtn = view.getByRole('button', { name: 'Add note' })
    expect(submitBtn.hasAttribute('disabled')).toBe(true)

    const textarea = view.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '   ' } })
    expect(submitBtn.hasAttribute('disabled')).toBe(true)

    fireEvent.change(textarea, { target: { value: 'Refactor this loop' } })
    expect(submitBtn.hasAttribute('disabled')).toBe(false)
  })

  it('parks focus on the textarea before the pressed submit button turns disabled', async () => {
    let resolveSubmit: (result: boolean) => void = () => {}
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve
        })
    )
    const view = render(
      <DiffCommentDraftCard lineNumber={10} onCancel={vi.fn()} onSubmit={onSubmit} />
    )
    const textarea = view.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Pending note' } })
    const submitBtn = view.getByRole('button', { name: 'Add note' })
    submitBtn.focus()
    expect(document.activeElement).toBe(submitBtn)
    fireEvent.click(submitBtn)

    // Chromium moves focus to <body> when a focused button turns disabled, which would stop the
    // draft zone from handing focus back to the editor once the save lands.
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(submitBtn.hasAttribute('disabled')).toBe(true)
    expect(document.activeElement).toBe(textarea)

    await act(async () => resolveSubmit(true))
  })

  it('calls onSubmit when clicking submit button', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(true)

    const view = render(
      <DiffCommentDraftCard lineNumber={10} onCancel={onCancel} onSubmit={onSubmit} />
    )

    const textarea = view.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Needs revision' } })

    const submitBtn = view.getByRole('button', { name: 'Add note' })
    await act(async () => {
      fireEvent.click(submitBtn)
    })

    expect(onSubmit).toHaveBeenCalledWith('Needs revision')
  })

  it('writes the note in the shared agent composer, which submits on Cmd+Enter only', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(true)

    const view = render(
      <DiffCommentDraftCard lineNumber={10} onCancel={onCancel} onSubmit={onSubmit} />
    )

    const textarea = view.getByRole('textbox')
    expect(textarea.getAttribute('data-composer')).toBe('agent')
    fireEvent.change(textarea, { target: { value: 'First line' } })

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })
    })
    expect(onSubmit).toHaveBeenCalledWith('First line')
  })

  it('submits Cmd+Shift+Enter and ignores duplicate submits while pending', async () => {
    let resolveSubmit: (result: boolean) => void = () => {}
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve
        })
    )
    const onCancel = vi.fn()
    const view = render(
      <DiffCommentDraftCard lineNumber={10} onCancel={onCancel} onSubmit={onSubmit} />
    )
    const textarea = view.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Pending note' } })
    const submitButton = view.getByRole('button', { name: 'Add note' })

    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true, shiftKey: true })
    fireEvent.click(submitButton)
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(view.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
    expect(onCancel).not.toHaveBeenCalled()

    await act(async () => resolveSubmit(true))
  })

  it('reports a rejected save to the user and re-enables the card', async () => {
    const error = new Error('network down')
    const onSubmit = vi.fn().mockRejectedValue(error)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = render(
      <DiffCommentDraftCard lineNumber={10} onCancel={vi.fn()} onSubmit={onSubmit} />
    )
    fireEvent.change(view.getByRole('textbox'), { target: { value: 'Rejected note' } })

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: 'Add note' }))
    })

    expect(toast.error).toHaveBeenCalledWith('Failed to save comment')
    expect(consoleError).toHaveBeenCalled()
    expect(view.getByRole('button', { name: 'Add note' }).hasAttribute('disabled')).toBe(false)
  })

  it('seeds and reports draft text so a re-anchored card can carry it', () => {
    const onBodyChange = vi.fn()
    const view = render(
      <DiffCommentDraftCard
        lineNumber={10}
        initialBody="Carried note"
        onBodyChange={onBodyChange}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />
    )
    const textarea = view.getByRole('textbox')
    expect(textarea instanceof HTMLTextAreaElement).toBe(true)
    if (textarea instanceof HTMLTextAreaElement) {
      expect(textarea.value).toBe('Carried note')
    }
    fireEvent.change(textarea, { target: { value: 'Updated note' } })
    expect(onBodyChange).toHaveBeenCalledWith('Updated note')
  })

  it('does not submit on Enter when IME composition is active', async () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(true)

    const view = render(
      <DiffCommentDraftCard lineNumber={10} onCancel={onCancel} onSubmit={onSubmit} />
    )

    const textarea = view.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'nihon' } })

    // IME composition
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onCancel when clicking Cancel or pressing Escape', () => {
    const onCancel = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(true)

    const view = render(
      <DiffCommentDraftCard lineNumber={10} onCancel={onCancel} onSubmit={onSubmit} />
    )

    const cancelBtn = view.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)
    expect(onCancel).toHaveBeenCalledTimes(1)

    const textarea = view.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('notifies onContentResize on mount and whenever the card resizes', () => {
    const onContentResize = vi.fn()
    let resize: () => void = () => undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback
        }
        observe(): void {}
        disconnect(): void {}
      }
    )

    render(
      <DiffCommentDraftCard
        lineNumber={10}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
        onContentResize={onContentResize}
      />
    )
    expect(onContentResize).toHaveBeenCalledTimes(1)

    resize()
    expect(onContentResize).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })

  it.each([
    ['Cmd+Enter', true],
    ['the Add note button', false]
  ])('saving with %s decides whether focus moves to the send button', async (_label, viaKeys) => {
    const view = render(
      <DiffCommentDraftCard
        lineNumber={3}
        onCancel={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
      />
    )
    const textarea = view.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Send me' } })
    await act(async () => {
      if (viaKeys) {
        fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })
      } else {
        fireEvent.click(view.getByRole('button', { name: 'Add note' }))
      }
    })

    noteCreatedForSendFocus('draft-note')
    expect(takeNoteSendFocus('draft-note')).toBe(viaKeys)
  })
})
