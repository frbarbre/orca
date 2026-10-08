// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React, { useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { MentionTextarea } from './textarea'

function Harness({ onValue }: { onValue: (value: string) => void }): React.JSX.Element {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement | null>(null)
  return (
    <MentionTextarea
      value={value}
      onValueChange={(next) => {
        setValue(next)
        onValue(next)
      }}
      placeholder="Reply"
      rows={2}
      mentionOptions={[]}
      textareaRef={ref}
    />
  )
}

describe('MentionTextarea emoji shortcodes', () => {
  afterEach(() => {
    cleanup()
  })

  it('suggests emoji for :name and inserts the picked one', () => {
    let latest = ''
    render(<Harness onValue={(value) => (latest = value)} />)
    const textarea = screen.getByPlaceholderText('Reply')

    fireEvent.change(textarea, { target: { value: 'nice :thumbs' } })
    const first = screen.getAllByRole('option')[0]
    expect(first?.textContent).toContain('👍')

    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(latest).toBe('nice 👍 ')
    expect(screen.queryByRole('option')).toBeNull()
  })
})
