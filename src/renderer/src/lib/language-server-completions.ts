import type * as Monaco from 'monaco-editor'
import type { LanguageServerCompletionItem } from '../../../shared/language-server'

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
  return {
    label: item.label,
    kind: kinds[kindName] ?? kinds.Text ?? 0,
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
