import type { EditorDiagnostic } from '../../../shared/editor-diagnostics'

type MarkerSeverities = { Hint: number; Info: number; Warning: number; Error: number }

const SEVERITY_BY_LSP = { 1: 'Error', 2: 'Warning', 3: 'Info', 4: 'Hint' } as const

export function toEditorMarker<U>(
  source: string,
  diagnostic: EditorDiagnostic,
  severity: MarkerSeverities,
  parseUri: (href: string) => U
): {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  severity: number
  source: string
  code?: string | { value: string; target: U }
  tags?: number[]
  message: string
} {
  const { code, href } = diagnostic
  return {
    startLineNumber: diagnostic.line + 1,
    startColumn: diagnostic.character + 1,
    endLineNumber: diagnostic.endLine + 1,
    endColumn: diagnostic.endCharacter + 1,
    severity: severity[SEVERITY_BY_LSP[diagnostic.severity]],
    source,
    ...(code ? { code: href ? { value: code, target: parseUri(href) } : code } : {}),
    // Why as is: Monaco's MarkerTag numbers LSP's tags the same, 1 unnecessary and 2 deprecated.
    ...(diagnostic.tags ? { tags: [...diagnostic.tags] } : {}),
    message: diagnostic.message
  }
}
