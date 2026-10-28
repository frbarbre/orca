import { pathToFileURL } from 'node:url'
import { languageServerForFile, type LanguageServerLocation } from '../../shared/language-server'
import type { EditorDiagnostic } from '../../shared/editor-diagnostics'
import { readDiagnosticList, readPublishDiagnostics } from './lsp-diagnostics'
import { createLspMessageReader, encodeLspMessage, type LspMessage } from './lsp-message-framing'
import { readDefinitionLocations, readHoverMarkdown } from './lsp-results'

export type LspTransport = {
  write: (chunk: Buffer) => void
  onData: (listener: (chunk: Buffer) => void) => void
  onExit: (listener: () => void) => void
  kill: () => void
}

export type DefinitionRequest = { filePath: string; text: string; line: number; character: number }

export type WatchedFileChange = { filePath: string; type: 'create' | 'update' | 'delete' }

export type LspSession = {
  readonly closed: boolean
  definition: (request: DefinitionRequest) => Promise<LanguageServerLocation[]>
  hover: (request: DefinitionRequest) => Promise<string | null>
  references: (request: DefinitionRequest) => Promise<LanguageServerLocation[]>
  /** Fork: what changed on disk, so the server's view of the project stays current. */
  filesChanged: (changes: readonly WatchedFileChange[]) => void
  /** Fork: hands the server the editor's text so it publishes diagnostics for it. */
  open: (filePath: string, text: string) => Promise<void>
  close: (filePath: string) => void
  /** Null when the server publishes diagnostics itself, or the file is not open in it. */
  pullDiagnostics: (filePath: string) => Promise<EditorDiagnostic[] | null>
  dispose: () => void
}

// LSP FileChangeType: Created = 1, Changed = 2, Deleted = 3.
// Why Changed before Created: an atomic save replaces a known file and arrives as a create, and
// tsgo drops a Created for a file it already has unless a Changed for it came first.
const FILE_CHANGE_TYPES: Record<WatchedFileChange['type'], readonly number[]> = {
  create: [2, 1],
  update: [2],
  delete: [3]
}

type IncomingMessage = {
  id?: number | string
  method?: string
  params?: { items?: unknown[] }
  result?: unknown
  error?: { message?: string }
}

const REQUEST_TIMEOUT_MS = 30_000

export function createLspSession({
  transport,
  rootPath,
  serverName = 'language server',
  onDiagnostics
}: {
  transport: LspTransport
  rootPath: string
  serverName?: string
  onDiagnostics?: (filePath: string, diagnostics: EditorDiagnostic[]) => void
}): LspSession {
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()
  const documents = new Map<string, { version: number; text: string }>()
  let nextId = 1
  let closed = false
  let ready = false
  let pullsDiagnostics = false
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
      return Promise.reject(new Error(`${serverName} exited`))
    }
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${serverName} did not answer ${method} in time`))
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
      const published = readPublishDiagnostics(message)
      if (published) {
        onDiagnostics?.(published.filePath, published.diagnostics)
        return
      }
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
        waiter?.reject(new Error(message.error.message ?? `${serverName} request failed`))
      } else {
        waiter?.resolve(message.result)
      }
    })
  )
  transport.onExit(() => close(`${serverName} exited`))

  const ensureInitialized = (): Promise<void> => {
    initialized ??= (async () => {
      const rootUri = pathToFileURL(rootPath).href
      const result = await request('initialize', {
        processId: process.pid,
        rootUri,
        workspaceFolders: [{ uri: rootUri, name: rootPath }],
        capabilities: {
          // Why: the servers rely on the client to watch the disk; without this an agent's new
          // module or export stayed unknown until the server was restarted.
          workspace: { didChangeWatchedFiles: { dynamicRegistration: false } },
          textDocument: {
            definition: { linkSupport: true },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            references: {},
            publishDiagnostics: { tagSupport: { valueSet: [1, 2] } },
            diagnostic: { dynamicRegistration: false }
          }
        }
      })
      send({ method: 'initialized', params: {} })
      ready = true
      pullsDiagnostics = Boolean(
        (result as { capabilities?: { diagnosticProvider?: unknown } } | null)?.capabilities
          ?.diagnosticProvider
      )
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
        params: {
          textDocument: {
            uri,
            languageId: languageServerForFile(filePath)?.lspLanguageId ?? 'plaintext',
            version: 1,
            text
          }
        }
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
    hover: async ({ filePath, text, line, character }) => {
      await ensureInitialized()
      const uri = syncDocument(filePath, text)
      const result = await request('textDocument/hover', {
        textDocument: { uri },
        position: { line, character }
      })
      return readHoverMarkdown(result)
    },
    references: async ({ filePath, text, line, character }) => {
      await ensureInitialized()
      const uri = syncDocument(filePath, text)
      const result = await request('textDocument/references', {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: true }
      })
      return Array.isArray(result) ? readDefinitionLocations(result) : []
    },
    open: async (filePath, text) => {
      await ensureInitialized()
      syncDocument(filePath, text)
    },
    close: (filePath) => {
      const uri = pathToFileURL(filePath).href
      if (documents.delete(uri)) {
        send({ method: 'textDocument/didClose', params: { textDocument: { uri } } })
      }
    },
    pullDiagnostics: async (filePath) => {
      const uri = pathToFileURL(filePath).href
      if (!pullsDiagnostics || !documents.has(uri)) {
        return null
      }
      const result = await request('textDocument/diagnostic', { textDocument: { uri } })
      return readDiagnosticList((result as { items?: unknown } | null)?.items)
    },
    filesChanged: (changes) => {
      // Why drop early changes: a server that is still starting reads the disk as it comes up.
      if (!ready || changes.length === 0) {
        return
      }
      for (const { filePath } of changes) {
        const uri = pathToFileURL(filePath).href
        // Why close: an open document is the server's copy of the file, so it would never see
        // the new disk content; the next request reopens it with the editor's text.
        if (documents.delete(uri)) {
          send({ method: 'textDocument/didClose', params: { textDocument: { uri } } })
        }
      }
      send({
        method: 'workspace/didChangeWatchedFiles',
        params: {
          changes: changes.flatMap(({ filePath, type }) => {
            const uri = pathToFileURL(filePath).href
            return FILE_CHANGE_TYPES[type].map((changeType) => ({ uri, type: changeType }))
          })
        }
      })
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
        close(`${serverName} stopped`)
        transport.kill()
      }, 2000).unref?.()
    }
  }
}
