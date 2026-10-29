import { describe, expect, it, vi } from 'vitest'
import { createLspMessageReader, encodeLspMessage, type LspMessage } from './lsp-message-framing'
import { createLspSession, type LspTransport } from './lsp-session'

type Message = {
  id?: number
  method?: string
  params?: Record<string, unknown> & { textDocument?: { languageId?: string } }
}

const FORMATTING_EDITS = [
  { range: { start: { line: 0, character: 6 }, end: { line: 2, character: 8 } }, newText: 'x = 1' },
  { range: { start: { line: 4 } }, newText: 'malformed' }
]

function fakeServer(
  definitionResult: unknown,
  hoverResult: unknown = null,
  referencesResult: unknown = null,
  pulledDiagnostics?: unknown[],
  completionResult: unknown = null
) {
  const received: Message[] = []
  let deliver: (chunk: Buffer) => void = () => {}
  let exit: () => void = () => {}
  const reply = (message: LspMessage) => deliver(encodeLspMessage({ jsonrpc: '2.0', ...message }))
  const read = createLspMessageReader((value) => {
    const message = value as Message
    received.push(message)
    if (message.method === 'initialize') {
      const capabilities = pulledDiagnostics
        ? { definitionProvider: true, diagnosticProvider: { interFileDependencies: true } }
        : { definitionProvider: true }
      reply({ id: message.id, result: { capabilities } })
      reply({ id: 900, method: 'workspace/configuration', params: { items: [{}] } })
    } else if (message.method === 'textDocument/completion') {
      reply({ id: message.id, result: completionResult })
    } else if (message.method === 'textDocument/diagnostic') {
      reply({ id: message.id, result: { kind: 'full', items: pulledDiagnostics ?? [] } })
    } else if (message.method === 'textDocument/definition') {
      reply({ id: message.id, result: definitionResult })
    } else if (message.method === 'textDocument/hover') {
      reply({ id: message.id, result: hoverResult })
    } else if (message.method === 'textDocument/references') {
      reply({ id: message.id, result: referencesResult })
    } else if (message.method === 'textDocument/formatting') {
      reply({ id: message.id, result: FORMATTING_EDITS })
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
  return { transport, received, exit: () => exit(), notify: reply }
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

  it('finds every reference, the declaration included', async () => {
    const at = (line: number) => ({
      uri: 'file:///repo/apps/backend/models/base.py',
      range: { start: { line, character: 6 }, end: { line, character: 18 } }
    })
    const server = fakeServer(null, null, [at(19), at(40)])
    const session = createLspSession({
      transport: server.transport,
      rootPath: '/repo/apps/backend'
    })

    await expect(session.references(request('x = 1'))).resolves.toEqual([
      { filePath: '/repo/apps/backend/models/base.py', line: 19, character: 6 },
      { filePath: '/repo/apps/backend/models/base.py', line: 40, character: 6 }
    ])
    const asked = server.received.find((message) => message.method === 'textDocument/references')
    expect(asked?.params?.context).toEqual({ includeDeclaration: true })
    expect(asked?.params?.position).toEqual({ line: 3, character: 8 })
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

  it('tells the server about files changed on disk and lets it reread an opened one', async () => {
    const server = fakeServer(null)
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })
    await session.definition(request('old text'))

    session.filesChanged([
      { filePath: '/repo/apps/backend/a.py', type: 'update' },
      { filePath: '/repo/apps/backend/new.py', type: 'create' },
      { filePath: '/repo/apps/backend/gone.py', type: 'delete' }
    ])
    await session.definition(request('new text'))

    const initialize = server.received.find((message) => message.method === 'initialize')
    expect(initialize?.params).toMatchObject({
      capabilities: { workspace: { didChangeWatchedFiles: { dynamicRegistration: false } } }
    })
    const methods = server.received.map((message) => message.method)
    expect(methods.slice(-4)).toEqual([
      'textDocument/didClose',
      'workspace/didChangeWatchedFiles',
      'textDocument/didOpen',
      'textDocument/definition'
    ])
    const watched = server.received.find(
      (message) => message.method === 'workspace/didChangeWatchedFiles'
    )
    expect(watched?.params).toEqual({
      changes: [
        { uri: 'file:///repo/apps/backend/a.py', type: 2 },
        { uri: 'file:///repo/apps/backend/new.py', type: 2 },
        { uri: 'file:///repo/apps/backend/new.py', type: 1 },
        { uri: 'file:///repo/apps/backend/gone.py', type: 3 }
      ]
    })
  })

  it('reports a created path as changed first, so an atomic save over a known file is reread', async () => {
    const server = fakeServer(null)
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })
    await session.definition(request('text'))

    session.filesChanged([{ filePath: '/repo/src/lib.ts', type: 'create' }])

    const watched = server.received.find(
      (message) => message.method === 'workspace/didChangeWatchedFiles'
    )
    expect(watched?.params).toEqual({
      changes: [
        { uri: 'file:///repo/src/lib.ts', type: 2 },
        { uri: 'file:///repo/src/lib.ts', type: 1 }
      ]
    })
  })

  it('opens a file for its diagnostics and hands on what the server publishes for it', async () => {
    const server = fakeServer(null)
    const onDiagnostics = vi.fn()
    const session = createLspSession({
      transport: server.transport,
      rootPath: '/repo',
      onDiagnostics
    })

    await session.open('/repo/src/a.ts', 'debugger')
    server.notify({
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: 'file:///repo/src/a.ts',
        diagnostics: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
            severity: 1,
            code: 'eslint(no-debugger)',
            codeDescription: { href: 'https://oxc.rs/no-debugger' },
            message: '`debugger` statement is not allowed'
          }
        ]
      }
    })

    expect(server.received.find((m) => m.method === 'textDocument/didOpen')?.params).toEqual({
      textDocument: {
        uri: 'file:///repo/src/a.ts',
        languageId: 'typescript',
        version: 1,
        text: 'debugger'
      }
    })
    expect(onDiagnostics).toHaveBeenCalledWith('/repo/src/a.ts', [
      {
        line: 0,
        character: 0,
        endLine: 0,
        endCharacter: 8,
        severity: 1,
        code: 'eslint(no-debugger)',
        href: 'https://oxc.rs/no-debugger',
        message: '`debugger` statement is not allowed'
      }
    ])
  })

  it('asks a server that offers it for the diagnostics of an open file, faded ones included', async () => {
    const server = fakeServer(null, null, null, [
      {
        range: { start: { line: 1, character: 6 }, end: { line: 1, character: 12 } },
        severity: 1,
        code: 2322,
        message: "Type 'string' is not assignable to type 'number'."
      },
      {
        range: { start: { line: 1, character: 6 }, end: { line: 1, character: 12 } },
        severity: 4,
        code: 6133,
        tags: [1],
        message: "'broken' is declared but its value is never read."
      }
    ])
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })
    await session.open('/repo/src/a.ts', 'x\nconst broken: number = "text"')

    await expect(session.pullDiagnostics('/repo/src/a.ts')).resolves.toEqual([
      {
        line: 1,
        character: 6,
        endLine: 1,
        endCharacter: 12,
        severity: 1,
        code: '2322',
        message: "Type 'string' is not assignable to type 'number'."
      },
      {
        line: 1,
        character: 6,
        endLine: 1,
        endCharacter: 12,
        severity: 4,
        code: '6133',
        tags: [1],
        message: "'broken' is declared but its value is never read."
      }
    ])
    expect(server.received.find((m) => m.method === 'textDocument/diagnostic')?.params).toEqual({
      textDocument: { uri: 'file:///repo/src/a.ts' }
    })
  })

  it('asks nothing of a server that publishes its diagnostics itself, or for a file it has not opened', async () => {
    const pushing = fakeServer(null)
    const pushSession = createLspSession({ transport: pushing.transport, rootPath: '/repo' })
    await pushSession.open('/repo/a.py', 'x')
    const pulling = fakeServer(null, null, null, [])
    const pullSession = createLspSession({ transport: pulling.transport, rootPath: '/repo' })
    await pullSession.open('/repo/a.ts', 'x')

    await expect(pushSession.pullDiagnostics('/repo/a.py')).resolves.toBeNull()
    await expect(pullSession.pullDiagnostics('/repo/b.ts')).resolves.toBeNull()
    expect(
      [...pushing.received, ...pulling.received].filter(
        (m) => m.method === 'textDocument/diagnostic'
      )
    ).toEqual([])
  })

  it('asks for completions at a position with the character that opened the list', async () => {
    const server = fakeServer(null, null, null, undefined, [{ label: 'append', kind: 2 }])
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })

    await expect(
      session.completion({ ...request('items.'), triggerCharacter: '.' })
    ).resolves.toEqual({
      incomplete: false,
      items: [{ label: 'append', kind: 2, insertText: 'append' }]
    })
    await session.completion(request('items.ap'))

    const asked = server.received.filter((m) => m.method === 'textDocument/completion')
    expect(asked.map((m) => m.params)).toEqual([
      {
        textDocument: { uri: 'file:///repo/apps/backend/a.py' },
        position: { line: 3, character: 8 },
        context: { triggerKind: 2, triggerCharacter: '.' }
      },
      {
        textDocument: { uri: 'file:///repo/apps/backend/a.py' },
        position: { line: 3, character: 8 },
        context: { triggerKind: 1 }
      }
    ])
    expect(
      server.received.find((m) => m.method === 'initialize')?.params?.capabilities
    ).toMatchObject({
      textDocument: { completion: { completionItem: { snippetSupport: true } } }
    })
  })

  it('closes a file it opened', async () => {
    const server = fakeServer(null)
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })
    await session.open('/repo/src/a.ts', 'x')

    session.close('/repo/src/a.ts')
    session.close('/repo/src/a.ts')

    expect(server.received.filter((m) => m.method === 'textDocument/didClose')).toEqual([
      {
        jsonrpc: '2.0',
        method: 'textDocument/didClose',
        params: { textDocument: { uri: 'file:///repo/src/a.ts' } }
      }
    ])
  })

  it('formats the text it is handed with the editor indentation and returns the edits', async () => {
    const server = fakeServer(null)
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })

    const edits = await session.format({
      filePath: '/repo/src/a.ts',
      text: 'const  x=1',
      tabSize: 4,
      insertSpaces: false
    })

    expect(edits).toEqual([
      { startLine: 0, startCharacter: 6, endLine: 2, endCharacter: 8, text: 'x = 1' }
    ])
    expect(server.received.find((m) => m.method === 'textDocument/didOpen')?.params).toMatchObject({
      textDocument: { uri: 'file:///repo/src/a.ts', text: 'const  x=1' }
    })
    expect(server.received.find((m) => m.method === 'textDocument/formatting')?.params).toEqual({
      textDocument: { uri: 'file:///repo/src/a.ts' },
      options: { tabSize: 4, insertSpaces: false }
    })
  })

  it('sends nothing before the server is up', () => {
    const server = fakeServer(null)
    const session = createLspSession({ transport: server.transport, rootPath: '/repo' })
    session.filesChanged([{ filePath: '/repo/a.py', type: 'update' }])
    expect(server.received).toEqual([])
  })
})
