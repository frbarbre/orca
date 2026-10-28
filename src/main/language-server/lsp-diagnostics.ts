import { fileURLToPath } from 'node:url'
import type { LintDiagnostic } from '../../shared/linter'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPosition(value: unknown): { line: number; character: number } | null {
  return isRecord(value) && typeof value.line === 'number' && typeof value.character === 'number'
    ? { line: value.line, character: value.character }
    : null
}

function readDiagnostic(value: unknown): LintDiagnostic | null {
  if (!isRecord(value) || !isRecord(value.range) || typeof value.message !== 'string') {
    return null
  }
  const start = readPosition(value.range.start)
  const end = readPosition(value.range.end)
  if (!start || !end) {
    return null
  }
  const severity = value.severity
  const code =
    typeof value.code === 'string' || typeof value.code === 'number' ? String(value.code) : null
  const href = isRecord(value.codeDescription) ? value.codeDescription.href : null
  return {
    line: start.line,
    character: start.character,
    endLine: end.line,
    endCharacter: end.character,
    // Why error by default: LSP leaves a missing severity to the client.
    severity: severity === 2 || severity === 3 || severity === 4 ? severity : 1,
    ...(code ? { code } : {}),
    ...(typeof href === 'string' ? { href } : {}),
    message: value.message
  }
}

export function readPublishDiagnostics(message: {
  method?: string
  params?: unknown
}): { filePath: string; diagnostics: LintDiagnostic[] } | null {
  const { method, params } = message
  if (
    method !== 'textDocument/publishDiagnostics' ||
    !isRecord(params) ||
    typeof params.uri !== 'string' ||
    !params.uri.startsWith('file:')
  ) {
    return null
  }
  const diagnostics = Array.isArray(params.diagnostics)
    ? params.diagnostics.flatMap((item: unknown) => {
        const diagnostic = readDiagnostic(item)
        return diagnostic ? [diagnostic] : []
      })
    : []
  return { filePath: fileURLToPath(params.uri), diagnostics }
}
