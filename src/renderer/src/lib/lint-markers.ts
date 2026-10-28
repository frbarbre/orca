import { LINTERS, type LintDiagnostic, type LinterId } from '../../../shared/linter'

type MarkerSeverities = { Hint: number; Info: number; Warning: number; Error: number }

const SEVERITY_BY_LSP = { 1: 'Error', 2: 'Warning', 3: 'Info', 4: 'Hint' } as const

export function toLintMarker<U>(
  linter: LinterId,
  diagnostic: LintDiagnostic,
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
  message: string
} {
  const { code, href } = diagnostic
  return {
    startLineNumber: diagnostic.line + 1,
    startColumn: diagnostic.character + 1,
    endLineNumber: diagnostic.endLine + 1,
    endColumn: diagnostic.endCharacter + 1,
    severity: severity[SEVERITY_BY_LSP[diagnostic.severity]],
    source: LINTERS[linter].name,
    ...(code ? { code: href ? { value: code, target: parseUri(href) } : code } : {}),
    message: diagnostic.message
  }
}
