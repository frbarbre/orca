import { pathToFileURL } from 'node:url'
import type {
  LanguageServerCodeAction,
  LanguageServerCompletionRef,
  LanguageServerCompletions,
  LanguageServerLocation,
  ResolvedCompletion
} from '../../shared/language-server'
import type { EditorDiagnostic } from '../../shared/editor-diagnostics'
import type { FormatDocumentRequest, FormatEdit } from '../../shared/formatter'
import { readDiagnosticList, readPublishDiagnostics } from './lsp-diagnostics'
import { createLspMessageReader, encodeLspMessage, type LspMessage } from './lsp-message-framing'
import { createCompletionLists, readCompletions, readResolvedCompletion } from './lsp-completions'
import { requestOrganizeImports, requestQuickFixes } from './lsp-code-actions'
import { createLspDocuments } from './lsp-documents'
import { LSP_CLIENT_CAPABILITIES, type ServerCapabilities } from './lsp-client-capabilities'
import { didChangeWatchedFiles, type WatchedFileChange } from './lsp-watched-files'
import { readDefinitionLocations, readHoverMarkdown, readTextEdits } from './lsp-results'

export type LspTransport = {
  write: (chunk: Buffer) => void
  onData: (listener: (chunk: Buffer) => void) => void
  onExit: (listener: () => void) => void
  kill: () => void
}

export type DefinitionRequest = { filePath: string; text: string; line: number; character: number }

export type { WatchedFileChange }

export type LspSession = {
  readonly closed: boolean
  definition: (request: DefinitionRequest) => Promise<LanguageServerLocation[]>
  hover: (request: DefinitionRequest) => Promise<string | null>
  references: (request: DefinitionRequest) => Promise<LanguageServerLocation[]>
  completion: (
    request: DefinitionRequest & { triggerCharacter?: string }
  ) => Promise<LanguageServerCompletions>
  /** Null when the item's list has been replaced since. */
  resolveCompletion: (item: LanguageServerCompletionRef) => Promise<ResolvedCompletion | null>
  codeActions: (
    request: DefinitionRequest & { endLine: number; endCharacter: number }
  ) => Promise<LanguageServerCodeAction[]>
  /** The edits that drop the file's unused imports, and sort the rest where the server can. */
  organizeImports: (request: { filePath: string; text: string }) => Promise<FormatEdit[]>
  /** Fork: what changed on disk, so the server's view of the project stays current. */
  filesChanged: (changes: readonly WatchedFileChange[]) => void
  /** Fork: hands the server the editor's text so it publishes diagnostics for it. */
  open: (filePath: string, text: string) => Promise<void>
  close: (filePath: string) => void
  /** Null when the server publishes diagnostics itself, or the file is not open in it. */
  pullDiagnostics: (filePath: string) => Promise<EditorDiagnostic[] | null>
  format: (request: FormatDocumentRequest) => Promise<FormatEdit[]>
  dispose: () => void
}

type IncomingMessage = {
  id?: number | string
  method?: string
  params?: { items?: unknown[]; diagnostics?: unknown[] }
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
  let nextId = 1
  let closed = false
  let ready = false
  let pullsDiagnostics = false
  let resolvesCompletions = false
  const completionLists = createCompletionLists()
  const published = new Map<string, unknown[]>()
  let initialized: Promise<void> | null = null

  const send = (message: LspMessage): void => {
    if (!closed) {
      transport.write(encodeLspMessage({ jsonrpc: '2.0', ...message }))
    }
  }
  const documents = createLspDocuments(send)

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
      const diagnostics = readPublishDiagnostics(message)
      if (diagnostics) {
        // Why keep the server's own: a quick fix is asked for with them, `data` and all.
        published.set(pathToFileURL(diagnostics.filePath).href, message.params?.diagnostics ?? [])
        onDiagnostics?.(diagnostics.filePath, diagnostics.diagnostics)
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
        capabilities: LSP_CLIENT_CAPABILITIES
      })
      send({ method: 'initialized', params: {} })
      ready = true
      const capabilities = (result as { capabilities?: ServerCapabilities } | null)?.capabilities
      pullsDiagnostics = Boolean(capabilities?.diagnosticProvider)
      resolvesCompletions = capabilities?.completionProvider?.resolveProvider === true
    })()
    return initialized
  }

  const syncDocument = documents.sync

  // Why the server's own diagnostics: a quick fix is asked for with them, `data` and all.
  const diagnosticsOf = async (uri: string): Promise<unknown[]> => {
    const pulled = pullsDiagnostics
      ? await request('textDocument/diagnostic', { textDocument: { uri } })
      : null
    const items = (pulled as { items?: unknown } | null)?.items
    return Array.isArray(items) ? items : (published.get(uri) ?? [])
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
    completion: async ({ filePath, text, line, character, triggerCharacter }) => {
      await ensureInitialized()
      const uri = syncDocument(filePath, text)
      const result = await request('textDocument/completion', {
        textDocument: { uri },
        position: { line, character },
        // LSP CompletionTriggerKind: Invoked = 1, TriggerCharacter = 2.
        context: triggerCharacter ? { triggerKind: 2, triggerCharacter } : { triggerKind: 1 }
      })
      return resolvesCompletions ? completionLists.read(result) : readCompletions(result)
    },
    resolveCompletion: async (ref) => {
      const item = completionLists.item(ref)
      return item === undefined
        ? null
        : readResolvedCompletion(await request('completionItem/resolve', item))
    },
    codeActions: async ({ filePath, text, ...range }) => {
      await ensureInitialized()
      const uri = syncDocument(filePath, text)
      return requestQuickFixes(request, { uri, diagnostics: await diagnosticsOf(uri), range })
    },
    organizeImports: async ({ filePath, text }) => {
      await ensureInitialized()
      const uri = syncDocument(filePath, text)
      const lineCount = text.split('\n').length
      const diagnostics = await diagnosticsOf(uri)
      return requestOrganizeImports(request, { uri, diagnostics, lineCount })
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
    close: documents.close,
    pullDiagnostics: async (filePath) => {
      const uri = pathToFileURL(filePath).href
      if (!pullsDiagnostics || !documents.isOpen(uri)) {
        return null
      }
      const result = await request('textDocument/diagnostic', { textDocument: { uri } })
      return readDiagnosticList((result as { items?: unknown } | null)?.items)
    },
    format: async ({ filePath, text, tabSize, insertSpaces }) => {
      await ensureInitialized()
      const uri = syncDocument(filePath, text)
      const result = await request('textDocument/formatting', {
        textDocument: { uri },
        options: { tabSize, insertSpaces }
      })
      return readTextEdits(result)
    },
    filesChanged: (changes) => {
      // Why drop early changes: a server that is still starting reads the disk as it comes up.
      if (!ready || changes.length === 0) {
        return
      }
      // Why close: an open document is the server's copy of the file, so it would never see
      // the new disk content; the next request reopens it with the editor's text.
      for (const { filePath } of changes) {
        documents.close(filePath)
      }
      send(didChangeWatchedFiles(changes))
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
