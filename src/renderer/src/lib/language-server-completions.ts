import type * as Monaco from 'monaco-editor'
import type {
  LanguageServerCompletionItem,
  LanguageServerTextEdit
} from '../../../shared/language-server'

type MonacoKind = keyof typeof Monaco.languages.CompletionItemKind

// LSP's CompletionItemKind, 1-based, by the name Monaco gives the same kind.
const KIND_BY_LSP: readonly MonacoKind[] = [
  'Text',
  'Method',
  'Function',
  'Constructor',
  'Field',
  'Variable',
  'Class',
  'Interface',
  'Module',
  'Property',
  'Unit',
  'Value',
  'Enum',
  'Keyword',
  'Snippet',
  'Color',
  'File',
  'Reference',
  'Folder',
  'EnumMember',
  'Constant',
  'Struct',
  'Event',
  'Operator',
  'TypeParameter'
]

export function toMonacoRange(edit: LanguageServerTextEdit): Monaco.IRange {
  return {
    startLineNumber: edit.startLine + 1,
    startColumn: edit.startCharacter + 1,
    endLineNumber: edit.endLine + 1,
    endColumn: edit.endCharacter + 1
  }
}

export function toMonacoTextEdits(
  edits: readonly LanguageServerTextEdit[]
): Monaco.languages.TextEdit[] {
  return edits.map((edit) => ({ range: toMonacoRange(edit), text: edit.text }))
}

export function toMonacoCompletion(
  item: LanguageServerCompletionItem,
  {
    kinds,
    insertAsSnippet,
    wordRange
  }: {
    kinds: Partial<Record<MonacoKind, number>>
    insertAsSnippet: number
    wordRange: Monaco.IRange
  }
): Monaco.languages.CompletionItem {
  const kindName = (item.kind ? KIND_BY_LSP[item.kind - 1] : undefined) ?? 'Text'
  const { range } = item
  const { labelDetail, labelDescription, additionalEdits } = item
  return {
    label:
      labelDetail || labelDescription
        ? {
            label: item.label,
            ...(labelDetail ? { detail: labelDetail } : {}),
            ...(labelDescription ? { description: labelDescription } : {})
          }
        : item.label,
    kind: kinds[kindName] ?? kinds.Text ?? 0,
    ...(additionalEdits ? { additionalTextEdits: toMonacoTextEdits(additionalEdits) } : {}),
    ...(item.detail ? { detail: item.detail } : {}),
    ...(item.documentation ? { documentation: { value: item.documentation } } : {}),
    ...(item.sortText ? { sortText: item.sortText } : {}),
    ...(item.filterText ? { filterText: item.filterText } : {}),
    insertText: item.insertText,
    ...(item.snippet ? { insertTextRules: insertAsSnippet } : {}),
    range: range
      ? {
          startLineNumber: range.line + 1,
          startColumn: range.character + 1,
          endLineNumber: range.endLine + 1,
          endColumn: range.endCharacter + 1
        }
      : wordRange
  }
}
