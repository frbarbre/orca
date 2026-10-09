import { describe, expect, it } from 'vitest'
import { createLspMessageReader, encodeLspMessage } from './lsp-message-framing'

describe('LSP message framing', () => {
  it('frames a message with its byte length, not its character length', () => {
    const framed = encodeLspMessage({ result: 'æø' })
    expect(framed.toString()).toBe('Content-Length: 17\r\n\r\n{"result":"æø"}')
  })

  it('reads messages split across chunks and several in one chunk', () => {
    const messages: unknown[] = []
    const feed = createLspMessageReader((message) => messages.push(message))
    const first = encodeLspMessage({ id: 1 })
    const second = encodeLspMessage({ id: 2, result: 'æ' })
    const both = Buffer.concat([first, second])

    feed(both.subarray(0, 7))
    feed(both.subarray(7, first.length + 3))
    expect(messages).toEqual([{ id: 1 }])
    feed(both.subarray(first.length + 3))
    expect(messages).toEqual([{ id: 1 }, { id: 2, result: 'æ' }])
  })
})
