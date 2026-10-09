import { fileURLToPath, pathToFileURL } from 'node:url'
import type { PythonDefinitionLocation } from '../../shared/python-definition'
import { createLspMessageReader, encodeLspMessage, type LspMessage } from './lsp-message-framing'

export type LspTransport = {
  write: (chunk: Buffer) => void
  onData: (listener: (chunk: Buffer) => void) => void
  onExit: (listener: () => void) => void
  kill: () => void
}

export type DefinitionRequest = { filePath: string; text: string; line: number; character: number }

export type PyreflySession = {
  readonly closed: boolean
  definition: (request: DefinitionRequest) => Promise<PythonDefinitionLocation[]>
  dispose: () => void
}

type Position = { line: number; character: number }
type Range = { start: Position; end: Position }
type IncomingMessage = {
  id?: number | string
  method?: string
  params?: { items?: unknown[] }
  result?: unknown
  error?: { message?: string }
}

const REQUEST_TIMEOUT_MS = 30_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRange(value: unknown): Range | null {
  if (!isRecord(value) || !isRecord(value.start)) {
    return null
  }
  const { line, character } = value.start
  return typeof line === 'number' && typeof character === 'number'
    ? { start: { line, character }, end: { line, character } }
    : null
}

function toLocation(value: unknown): PythonDefinitionLocation | null {
  if (!isRecord(value)) {
    return null
  }
  const uri = typeof value.targetUri === 'string' ? value.targetUri : value.uri
  const range = readRange(value.targetSelectionRange ?? value.targetRange ?? value.range)
  if (typeof uri !== 'string' || !uri.startsWith('file:') || !range) {
    return null
  }
  return { filePath: fileURLToPath(uri), line: range.start.line, character: range.start.character }
}

export function readDefinitionLocations(result: unknown): PythonDefinitionLocation[] {
  const items = Array.isArray(result) ? result : [result]
  return items.flatMap((item) => {
    const location = toLocation(item)
    return location ? [location] : []
  })
}

export function createPyreflySession({
  transport,
  rootPath
}: {
  transport: LspTransport
  rootPath: string
}): PyreflySession {
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()
  const documents = new Map<string, { version: number; text: string }>()
  let nextId = 1
  let closed = false
  let initialized: Promise<void> | null = null

  const send = (message: LspMessage): void => {
    if (!closed) {
      transport.write(encodeLspMessage({ jsonrpc: '2.0', ...message }))
    }
  }

  const close = (reason: string): void => {
    if (closed) {
      return
    }
    closed = true
    for (const { reject } of pending.values()) {
      reject(new Error(reason))
    }
    pending.clear()
  }

  const request = (method: string, params: unknown): Promise<unknown> => {
    if (closed) {
      return Promise.reject(new Error('pyrefly exited'))
    }
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`pyrefly did not answer ${method} in time`))
      }, REQUEST_TIMEOUT_MS)
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        }
      })
      send({ id, method, params })
    })
  }

  transport.onData(
    createLspMessageReader((value) => {
      const message = value as IncomingMessage
      if (message.method && message.id !== undefined) {
        // Why answer server requests: an unanswered workspace/configuration stalls the server.
        const items = message.params?.items
        send({ id: message.id, result: Array.isArray(items) ? items.map(() => null) : null })
        return
      }
      if (typeof message.id !== 'number') {
        return
      }
      const waiter = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) {
        waiter?.reject(new Error(message.error.message ?? 'pyrefly request failed'))
      } else {
        waiter?.resolve(message.result)
      }
    })
  )
  transport.onExit(() => close('pyrefly exited'))

  const ensureInitialized = (): Promise<void> => {
    initialized ??= (async () => {
      const rootUri = pathToFileURL(rootPath).href
      await request('initialize', {
        processId: process.pid,
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: rootPath }],
        capabilities: { textDocument: { definition: { linkSupport: true } } }
      })
      send({ method: 'initialized', params: {} })
    })()
    return initialized
  }

  const syncDocument = (filePath: string, text: string): string => {
    const uri = pathToFileURL(filePath).href
    const known = documents.get(uri)
    if (!known) {
      documents.set(uri, { version: 1, text })
      send({
        method: 'textDocument/didOpen',
        params: { textDocument: { uri, languageId: 'python', version: 1, text } }
      })
    } else if (known.text !== text) {
      const version = known.version + 1
      documents.set(uri, { version, text })
      send({
        method: 'textDocument/didChange',
        params: { textDocument: { uri, version }, contentChanges: [{ text }] }
      })
    }
    return uri
  }

  return {
    get closed() {
      return closed
    },
    definition: async ({ filePath, text, line, character }) => {
      await ensureInitialized()
      const uri = syncDocument(filePath, text)
      const result = await request('textDocument/definition', {
        textDocument: { uri },
        position: { line, character }
      })
      return readDefinitionLocations(result)
    },
    dispose: () => {
      if (closed) {
        return
      }
      void request('shutdown', null)
        .then(() => send({ method: 'exit' }))
        .catch(() => {})
        .finally(() => transport.kill())
      setTimeout(() => {
        close('pyrefly stopped')
        transport.kill()
      }, 2000).unref?.()
    }
  }
}
