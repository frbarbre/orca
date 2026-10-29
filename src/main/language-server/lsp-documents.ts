import { pathToFileURL } from 'node:url'
import { languageServerForFile } from '../../shared/language-server'
import type { LspMessage } from './lsp-message-framing'

/** The files a server holds open, and the text it last got for each. */
export function createLspDocuments(send: (message: LspMessage) => void): {
  /** Opens the file in the server, or hands it the new text; returns the file's URI. */
  sync: (filePath: string, text: string) => string
  close: (filePath: string) => void
  isOpen: (uri: string) => boolean
} {
  const documents = new Map<string, { version: number; text: string }>()
  return {
    sync: (filePath, text) => {
      const uri = pathToFileURL(filePath).href
      const known = documents.get(uri)
      if (!known) {
        documents.set(uri, { version: 1, text })
        const languageId = languageServerForFile(filePath)?.lspLanguageId ?? 'plaintext'
        send({
          method: 'textDocument/didOpen',
          params: { textDocument: { uri, languageId, version: 1, text } }
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
    },
    close: (filePath) => {
      const uri = pathToFileURL(filePath).href
      if (documents.delete(uri)) {
        send({ method: 'textDocument/didClose', params: { textDocument: { uri } } })
      }
    },
    isOpen: (uri) => documents.has(uri)
  }
}
