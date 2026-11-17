// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SendMessageDialog, useSendMessageRequest } from './send-message-dialog'

afterEach(() => {
  cleanup()
})

function renderDialog() {
  const send = vi.fn()
  const onCancel = vi.fn()
  render(<SendMessageDialog request={{ count: 3, send }} onCancel={onCancel} />)
  return { send, onCancel, field: screen.getByRole('textbox', { name: 'Message for the agent' }) }
}

describe('useSendMessageRequest', () => {
  it('asks first, then sends the queued items with the message and closes', () => {
    const send = vi.fn()
    const { result } = renderHook(() => useSendMessageRequest<string>(send))

    act(() => result.current.ask(['a', 'b']))
    expect(send).not.toHaveBeenCalled()
    expect(result.current.request?.count).toBe(2)

    act(() => result.current.request?.send('Be brief.'))
    expect(send).toHaveBeenCalledWith(['a', 'b'], 'Be brief.')
    expect(result.current.request).toBeNull()
  })
})

describe('SendMessageDialog', () => {
  it('opens with the message field focused and sends what was typed on Enter', async () => {
    const { send, field } = renderDialog()
    await vi.waitFor(() => expect(document.activeElement).toBe(field))

    fireEvent.change(field, { target: { value: 'Only the backend ones.' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(send).toHaveBeenCalledWith('Only the backend ones.')
  })

  it('sends with no message too', () => {
    const { send, field } = renderDialog()

    fireEvent.keyDown(field, { key: 'Enter' })

    expect(send).toHaveBeenCalledWith('')
  })

  it('keeps Shift+Enter for a new line', () => {
    const { send, field } = renderDialog()

    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true })

    expect(send).not.toHaveBeenCalled()
  })

  it('cancels on Escape without sending', () => {
    const { send, onCancel, field } = renderDialog()

    fireEvent.keyDown(field, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})
