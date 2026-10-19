// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTextareaFileMentions } from './note-reply-file-mentions'

vi.mock('@/lib/use-worktree-mention-files', () => ({
  useWorktreeMentionFiles: (query: string | null) => ({
    files: query === null ? [] : ['CLAUDE.md', 'apps/frontend/CLAUDE.md'],
    loading: false,
    failed: false
  })
}))

afterEach(cleanup)

function Probe(): React.JSX.Element {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const mentions = useTextareaFileMentions({
    value,
    onChange: setValue,
    textareaRef: ref,
    worktreeId: 'wt-1'
  })
  return (
    <>
      <textarea
        ref={ref}
        aria-label="reply"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          mentions.onInput(event.currentTarget)
        }}
        onKeyDown={(event) => mentions.onKeyDown(event)}
      />
      {mentions.list}
    </>
  )
}

function type(textarea: HTMLTextAreaElement, value: string): void {
  textarea.setSelectionRange(value.length, value.length)
  fireEvent.change(textarea, { target: { value, selectionStart: value.length } })
}

describe('useTextareaFileMentions', () => {
  it('suggests workspace files after @ and inserts the chosen path', async () => {
    render(<Probe />)
    const textarea = screen.getByLabelText('reply') as HTMLTextAreaElement
    type(textarea, 'Is that not what @CLA')

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'CLAUDE.md',
      'CLAUDE.md'
    ])
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' })
    })
    expect(textarea.value).toBe('Is that not what @apps/frontend/CLAUDE.md ')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('lets Enter through when no suggestion is open, and Escape closes the list', () => {
    render(<Probe />)
    const textarea = screen.getByLabelText('reply') as HTMLTextAreaElement
    type(textarea, 'plain text')
    expect(screen.queryByRole('listbox')).toBeNull()

    type(textarea, 'see @')
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
