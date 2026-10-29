import type {
  LanguageServerCodeActionRequest,
  LanguageServerCodeActionsResult,
  LanguageServerCompletionRequest,
  LanguageServerCompletionResult,
  LanguageServerDefinitionResult,
  LanguageServerDocument,
  LanguageServerEditsResult,
  LanguageServerHoverResult,
  LanguageServerLanguage,
  LanguageServerReferencesResult,
  LanguageServerRequest,
  LanguageServerResolveRequest,
  LanguageServerResolveResult
} from './language-server'
import type { DiagnosticsSyncResult, EditorDiagnosticsEvent } from './editor-diagnostics'

export type LanguageServerApi = {
  definition: (args: LanguageServerRequest) => Promise<LanguageServerDefinitionResult>
  hover: (args: LanguageServerRequest) => Promise<LanguageServerHoverResult>
  references: (args: LanguageServerRequest) => Promise<LanguageServerReferencesResult>
  completion: (args: LanguageServerCompletionRequest) => Promise<LanguageServerCompletionResult>
  /** Fills in an item of the latest list, like the import tsgo adds for an auto-import. */
  resolveCompletion: (args: LanguageServerResolveRequest) => Promise<LanguageServerResolveResult>
  codeActions: (args: LanguageServerCodeActionRequest) => Promise<LanguageServerCodeActionsResult>
  organizeImports: (args: LanguageServerDocument) => Promise<LanguageServerEditsResult>
  stop: (args: { language: LanguageServerLanguage }) => Promise<void>
  /** Hands the server an editor's text; its errors arrive through `onDiagnostics`. */
  sync: (args: LanguageServerDocument) => Promise<DiagnosticsSyncResult>
  closeDocument: (args: { language: LanguageServerLanguage; filePath: string }) => Promise<void>
  onDiagnostics: (callback: (event: EditorDiagnosticsEvent) => void) => () => void
}
