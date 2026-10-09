import { describe, expect, it, vi } from 'vitest'
import { createLspMessageReader, encodeLspMessage, type LspMessage } from './lsp-message-framing'
import { createLspSession, type LspTransport } from './lsp-session'

type Message = {
  id?: number
  method?: string
  params?: Record<string, unknown> & { textDocument?: { languageId?: string } }
}

function fakeServer(definitionResult: unknown, hoverResult: unknown = null) {
  const received: Message[] = []
  let deliver: (chunk: Buffer) => void = () => {}
  let exit: () => void = () => {}
  const reply = (message: LspMessage) => deliver(encodeLspMessage({ jsonrpc: '2.0', ...message }))
  const read = createLspMessageReader((value) => {
    const message = value as Message
    received.push(message)
    if (message.method === 'initialize') {
      reply({ id: message.id, result: { capabilities: { definitionProvider: true } } })
      reply({ id: 900, method: 'workspace/configuration', params: { items: [{}] } })
    } else if (message.method === 'textDocument/definition') {
      reply({ id: message.id, result: definitionResult })
    } else if (message.method === 'textDocument/hover') {
      reply({ id: message.id, result: hoverResult })
    }
  })
  const transport: LspTransport = {
    write: (chunk) => read(chunk),
    onData: (listener) => {
      deliver = listener
    },
    onExit: (listener) => {
      exit = listener
    },
    kill: vi.fn()
  }
  return { transport, received, exit: () => exit() }
}

const request = (text: string) => ({
  filePath: '/repo/apps/backend/a.py',
  text,
  line: 3,
  character: 8
})

describe('LSP session', () => {
  it('opens each file with the language id its extension calls for', async () => {
    const server = fakeServer(null)
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })

    for (const filePath of [
      '/repo/a.tsx',
      '/repo/b.ts',
      '/repo/c.jsx',
      '/repo/d.mjs',
      '/repo/e.py'
    ]) {
      await session.definition({ ...request(''), filePath })
    }
    const languageIds = server.received
      .filter((message) => message.method === 'textDocument/didOpen')
      .map((message) => message.params?.textDocument?.languageId)
    expect(languageIds).toEqual([
      'typescriptreact',
      'typescript',
      'javascriptreact',
      'javascript',
      'python'
    ])
  })

  it('initializes once, opens then updates the file, and returns definition locations', async () => {
    const server = fakeServer({
      uri: 'file:///repo/apps/backend/domain/frame%20parameter.py',
      range: { start: { line: 10, character: 6 }, end: { line: 10, character: 22 } }
    })
    const session = createLspSession({
      transport: server.transport,
      rootPath: '/repo/apps/backend'
    })

    await expect(session.definition(request('x = 1'))).resolves.toEqual([
      { filePath: '/repo/apps/backend/domain/frame parameter.py', line: 10, character: 6 }
    ])
    await session.definition(request('x = 1'))
    await session.definition(request('x = 2'))

    const methods = server.received.map((message) => message.method ?? `reply:${message.id}`)
    expect(methods).toEqual([
      'initialize',
      'reply:900',
      'initialized',
      'textDocument/didOpen',
      'textDocument/definition',
      'textDocument/definition',
      'textDocument/didChange',
      'textDocument/definition'
    ])
    expect(server.received[0]?.params?.rootUri).toBe('file:///repo/apps/backend')
  })

  it('reads location links too', async () => {
    const server = fakeServer([
      {
        targetUri: 'file:///repo/b.py',
        targetRange: { start: { line: 0, character: 0 }, end: { line: 5, character: 0 } },
        targetSelectionRange: { start: { line: 2, character: 4 }, end: { line: 2, character: 9 } }
      }
    ])
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })

    await expect(session.definition(request(''))).resolves.toEqual([
      { filePath: '/repo/b.py', line: 2, character: 4 }
    ])
  })

  it('asks for hover text at a position and returns it as markdown', async () => {
    const markup = { kind: 'markdown', value: '```python\nx: FrameParameterId\n```' }
    const server = fakeServer(null, { contents: markup })
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })

    await expect(session.hover(request('x = 1'))).resolves.toBe(markup.value)
    const hover = server.received.find((message) => message.method === 'textDocument/hover')
    expect(hover?.params?.position).toEqual({ line: 3, character: 8 })
  })

  it('reads the older hover shapes and an empty hover', async () => {
    const strings = fakeServer(null, {
      contents: [{ language: 'python', value: 'def f() -> int' }, 'Docs.']
    })
    const fromStrings = createLspSession({ transport: strings.transport, rootPath: '/repo' })
    await expect(fromStrings.hover(request(''))).resolves.toBe(
      '```python\ndef f() -> int\n```\n\nDocs.'
    )

    const empty = createLspSession({ transport: fakeServer(null).transport, rootPath: '/r' })
    await expect(empty.hover(request(''))).resolves.toBeNull()
  })

  it('fails pending requests and reports itself closed when the server exits', async () => {
    const server = fakeServer(null)
    server.transport.write = () => {}
    const session = createLspSession({
      transport: server.transport,
      rootPath: '/repo',
      serverName: 'tsgo'
    })

    const pending = session.definition(request(''))
    server.exit()
    await expect(pending).rejects.toThrow('tsgo exited')
    expect(session.closed).toBe(true)
  })
})
