export type ServerCapabilities = {
  diagnosticProvider?: unknown
  completionProvider?: { resolveProvider?: boolean }
}

export const LSP_CLIENT_CAPABILITIES = {
  // Why: the servers rely on the client to watch the disk; without this an agent's new
  // module or export stayed unknown until the server was restarted.
  workspace: { didChangeWatchedFiles: { dynamicRegistration: false } },
  textDocument: {
    definition: { linkSupport: true },
    hover: { contentFormat: ['markdown', 'plaintext'] },
    references: {},
    completion: {
      completionItem: {
        snippetSupport: true,
        documentationFormat: ['markdown', 'plaintext'],
        labelDetailsSupport: true,
        // Why: tsgo leaves an auto-import's import edit out until the item is resolved.
        resolveSupport: { properties: ['documentation', 'detail', 'additionalTextEdits'] }
      },
      contextSupport: true
    },
    codeAction: {
      codeActionLiteralSupport: {
        codeActionKind: { valueSet: ['quickfix', 'source.organizeImports'] }
      },
      isPreferredSupport: true
    },
    publishDiagnostics: { tagSupport: { valueSet: [1, 2] } },
    diagnostic: { dynamicRegistration: false }
  }
}
