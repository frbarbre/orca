import type { LanguageServerLanguage } from './language-server'
import type { LinterId } from './linter'

/** Zero-based, as the language server reports it. Severity is LSP's: 1 error to 4 hint. */
export type EditorDiagnostic = {
  line: number
  character: number
  endLine: number
  endCharacter: number
  severity: 1 | 2 | 3 | 4
  code?: string
  href?: string
  /** LSP's: 1 unnecessary (shown faded), 2 deprecated (struck through). */
  tags?: (1 | 2)[]
  message: string
}

/** A linter, or a language's server reporting type errors. */
export type DiagnosticSource = LinterId | LanguageServerLanguage

export type EditorDiagnosticsEvent = {
  source: DiagnosticSource
  filePath: string
  diagnostics: EditorDiagnostic[]
}

export type DiagnosticsSyncResult = { ok: true } | { ok: false; error: string }
