// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import React, { useRef, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMentionAutocomplete } from './github-mention-autocomplete'

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const OPTIONS = [
  { login: 'madsenmm', name: 'Tobias Mønster Madsen', source: 'Member' },
  { login: 'zahlio', name: null, source: 'Member' }
]

function Harness(): React.JSX.Element {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const mention = useMentionAutocomplete({ value, setValue, textareaRef: ref, options: OPTIONS })
  return (
    <div className="relative">
      {mention.list}
      <textarea
        aria-label="comment"
        ref={ref}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          mention.sync(event.currentTarget)
        }}
        onKeyDown={mention.handleKeyDown}
      />
    </div>
  )
}

function type(textarea: HTMLTextAreaElement, text: string): void {
  fireEvent.change(textarea, { target: { value: text, selectionStart: text.length } })
  textarea.setSelectionRange(text.length, text.length)
  fireEvent.change(textarea, { target: { value: text } })
}

describe('useMentionAutocomplete', () => {
  afterEach(cleanup)

  it('lists matching members after @ and inserts the chosen login', () => {
    render(<Harness />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('comment')
    type(textarea, 'Thanks @mad')

    expect(screen.getByRole('option', { name: /@madsenmm/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /@zahlio/ })).toBeNull()

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(textarea.value).toBe('Thanks @madsenmm ')
  })

  it('closes on Escape without inserting', () => {
    render(<Harness />)
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('comment')
    type(textarea, '@')
    expect(screen.getAllByRole('option')).toHaveLength(2)

    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByRole('option')).toBeNull()
    expect(textarea.value).toBe('@')
  })
})
