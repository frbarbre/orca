import type {
  LanguageServerCompletionItem,
  LanguageServerCompletionRef,
  LanguageServerCompletions,
  ResolvedCompletion
} from '../../shared/language-server'
import { readTextEdits } from './lsp-results'

type Range = NonNullable<LanguageServerCompletionItem['range']>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRange(value: unknown): Range | null {
  if (!isRecord(value) || !isRecord(value.start) || !isRecord(value.end)) {
    return null
  }
  const { start, end } = value
  return typeof start.line === 'number' &&
    typeof start.character === 'number' &&
    typeof end.line === 'number' &&
    typeof end.character === 'number'
    ? {
        line: start.line,
        character: start.character,
        endLine: end.line,
        endCharacter: end.character
      }
    : null
}

function readDocumentation(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  return isRecord(value) && typeof value.value === 'string' ? value.value : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function withoutNulls<T extends Record<string, unknown>>(
  entries: T
): Partial<{ [K in keyof T]: NonNullable<T[K]> }> {
  return Object.fromEntries(Object.entries(entries).filter(([, entry]) => entry !== null)) as {
    [K in keyof T]: NonNullable<T[K]>
  }
}

export function readResolvedCompletion(value: unknown): ResolvedCompletion {
  if (!isRecord(value)) {
    return {}
  }
  const additionalEdits = readTextEdits(value.additionalTextEdits)
  return {
    ...withoutNulls({
      detail: text(value.detail),
      documentation: readDocumentation(value.documentation)
    }),
    ...(additionalEdits.length > 0 ? { additionalEdits } : {})
  }
}

function readItem(value: unknown): LanguageServerCompletionItem | null {
  if (!isRecord(value) || typeof value.label !== 'string' || !value.label) {
    return null
  }
  const edit = isRecord(value.textEdit) ? value.textEdit : null
  // Why insert over replace: accepting a name mid-word should not eat the rest of the word.
  const range = edit ? readRange(edit.range ?? edit.insert) : null
  const labelDetails = isRecord(value.labelDetails) ? value.labelDetails : {}
  return {
    label: value.label,
    ...withoutNulls({
      labelDetail: text(labelDetails.detail),
      labelDescription: text(labelDetails.description),
      kind: typeof value.kind === 'number' ? value.kind : null,
      sortText: text(value.sortText),
      filterText: text(value.filterText)
    }),
    ...readResolvedCompletion(value),
    insertText: text(edit?.newText) ?? text(value.insertText) ?? value.label,
    ...(value.insertTextFormat === 2 ? { snippet: true as const } : {}),
    ...(range ? { range } : {})
  }
}

// Why two shapes: LSP answers a completion with a CompletionList or a bare CompletionItem[].
function rawItems(result: unknown): unknown {
  return Array.isArray(result) ? result : isRecord(result) ? result.items : null
}

// Why only the latest answer: Monaco resolves items of the list it shows, and a new answer
// replaces that list.
export function createCompletionLists(): {
  read: (result: unknown) => LanguageServerCompletions
  item: (ref: LanguageServerCompletionRef) => unknown
} {
  let latest = { id: 0, items: [] as unknown[] }
  return {
    read: (result) => {
      const items = rawItems(result)
      latest = { id: latest.id + 1, items: Array.isArray(items) ? items : [] }
      return readCompletions(result, latest.id)
    },
    item: ({ list, index }) => (latest.id === list ? latest.items[index] : undefined)
  }
}

// `list` numbers the answer when the server fills items in on request.
export function readCompletions(result: unknown, list?: number): LanguageServerCompletions {
  const items = rawItems(result)
  return {
    incomplete: isRecord(result) && result.isIncomplete === true,
    items: Array.isArray(items)
      ? items.flatMap((item: unknown, index) => {
          const read = readItem(item)
          if (!read) {
            return []
          }
          return [list === undefined ? read : { ...read, resolve: { list, index } }]
        })
      : []
  }
}
