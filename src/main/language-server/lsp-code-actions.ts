import type { LanguageServerCodeAction, LanguageServerTextEdit } from '../../shared/language-server'
import { readTextEdits } from './lsp-results'

type Position = { line: number; character: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPosition(value: unknown): Position | null {
  return isRecord(value) && typeof value.line === 'number' && typeof value.character === 'number'
    ? { line: value.line, character: value.character }
    : null
}

function before(a: Position, b: Position): boolean {
  return a.line < b.line || (a.line === b.line && a.character < b.character)
}

export function diagnosticsTouching(
  diagnostics: readonly unknown[],
  range: { line: number; character: number; endLine: number; endCharacter: number }
): unknown[] {
  const start = { line: range.line, character: range.character }
  const end = { line: range.endLine, character: range.endCharacter }
  return diagnostics.filter((diagnostic) => {
    const span = isRecord(diagnostic) && isRecord(diagnostic.range) ? diagnostic.range : null
    const from = readPosition(span?.start)
    const to = readPosition(span?.end)
    return from !== null && to !== null && !before(to, start) && !before(end, from)
  })
}

// Why only this file's edits: an action that also creates or changes another file would be
// applied half, so it is left out.
function editsOfFile(edit: unknown, uri: string): unknown[] | null {
  if (!isRecord(edit)) {
    return null
  }
  if (Array.isArray(edit.documentChanges)) {
    const edits: unknown[] = []
    for (const change of edit.documentChanges) {
      const document =
        isRecord(change) && isRecord(change.textDocument) ? change.textDocument : null
      if (document?.uri !== uri || !isRecord(change) || !Array.isArray(change.edits)) {
        return null
      }
      edits.push(...change.edits)
    }
    return edits
  }
  if (!isRecord(edit.changes)) {
    return null
  }
  const files = Object.keys(edit.changes)
  const edits = edit.changes[uri]
  return files.length === 1 && Array.isArray(edits) ? edits : null
}

export async function requestQuickFixes(
  request: (method: string, params: unknown) => Promise<unknown>,
  {
    uri,
    diagnostics,
    range
  }: {
    uri: string
    diagnostics: readonly unknown[]
    range: { line: number; character: number; endLine: number; endCharacter: number }
  }
): Promise<LanguageServerCodeAction[]> {
  const { line, character, endLine, endCharacter } = range
  const result = await request('textDocument/codeAction', {
    textDocument: { uri },
    range: { start: { line, character }, end: { line: endLine, character: endCharacter } },
    context: {
      diagnostics: diagnosticsTouching(diagnostics, range),
      only: ['quickfix'],
      triggerKind: 1
    }
  })
  return readCodeActions(result, uri)
}

function startOf(edit: LanguageServerTextEdit): Position {
  return { line: edit.startLine, character: edit.startCharacter }
}

function endOf(edit: LanguageServerTextEdit): Position {
  return { line: edit.endLine, character: edit.endCharacter }
}

function overlaps(a: LanguageServerTextEdit, b: LanguageServerTextEdit): boolean {
  return before(startOf(a), endOf(b)) && before(startOf(b), endOf(a))
}

// Why the fallback: pyrefly has no organize-imports action, only a quick fix per unused import.
export async function requestOrganizeImports(
  request: (method: string, params: unknown) => Promise<unknown>,
  {
    uri,
    diagnostics,
    lineCount
  }: { uri: string; diagnostics: readonly unknown[]; lineCount: number }
): Promise<LanguageServerTextEdit[]> {
  const ask = async (range: unknown, kind: string, about: readonly unknown[]) =>
    readCodeActions(
      await request('textDocument/codeAction', {
        textDocument: { uri },
        range,
        context: { diagnostics: about, only: [kind], triggerKind: 1 }
      }),
      uri
    )
  const whole = { start: { line: 0, character: 0 }, end: { line: lineCount, character: 0 } }
  const [organize] = await ask(whole, 'source.organizeImports', [])
  if (organize) {
    return organize.edits
  }
  const edits: LanguageServerTextEdit[] = []
  for (const diagnostic of diagnostics) {
    if (!isRecord(diagnostic) || diagnostic.code !== 'unused-import') {
      continue
    }
    const fixes = await ask(diagnostic.range, 'quickfix', [diagnostic])
    const removal = fixes.find((fix) => /unused import/i.test(fix.title))
    // Why skip an overlap: two fixes on one import line each rewrite it, and Monaco rejects both.
    if (removal && !removal.edits.some((edit) => edits.some((taken) => overlaps(edit, taken)))) {
      edits.push(...removal.edits)
    }
  }
  return edits
}

export function readCodeActions(result: unknown, uri: string): LanguageServerCodeAction[] {
  return (Array.isArray(result) ? result : []).flatMap((value: unknown) => {
    if (!isRecord(value) || typeof value.title !== 'string' || !value.title) {
      return []
    }
    const edits = editsOfFile(value.edit, uri)
    return edits
      ? [
          {
            title: value.title,
            ...(value.isPreferred === true ? { preferred: true as const } : {}),
            edits: readTextEdits(edits)
          }
        ]
      : []
  })
}
