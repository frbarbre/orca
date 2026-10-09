const HEADER_END = Buffer.from('\r\n\r\n')
const CONTENT_LENGTH = /content-length:\s*(\d+)/i

export type LspMessage = {
  jsonrpc?: '2.0'
  id?: number | string
  method?: string
  params?: unknown
  result?: unknown
  error?: unknown
}

export function encodeLspMessage(message: LspMessage): Buffer {
  const body = Buffer.from(JSON.stringify(message), 'utf8')
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body])
}

// Why bytes: Content-Length counts UTF-8 bytes, so slicing decoded text would split multi-byte characters.
export function createLspMessageReader(
  onMessage: (message: unknown) => void
): (chunk: Buffer) => void {
  let buffer = Buffer.alloc(0)
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    for (;;) {
      const headerEnd = buffer.indexOf(HEADER_END)
      if (headerEnd === -1) {
        return
      }
      const length = Number(CONTENT_LENGTH.exec(buffer.subarray(0, headerEnd).toString())?.[1])
      const bodyStart = headerEnd + HEADER_END.length
      if (!Number.isFinite(length)) {
        buffer = buffer.subarray(bodyStart)
        continue
      }
      if (buffer.length < bodyStart + length) {
        return
      }
      const body = buffer.subarray(bodyStart, bodyStart + length).toString('utf8')
      buffer = buffer.subarray(bodyStart + length)
      try {
        onMessage(JSON.parse(body))
      } catch {
        // An unreadable message is dropped; the framing itself is still intact.
      }
    }
  }
}
