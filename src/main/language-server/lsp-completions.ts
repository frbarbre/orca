import type {
  LanguageServerCompletionItem,
  LanguageServerCompletions
} from '../../shared/language-server'

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

function readItem(value: unknown): LanguageServerCompletionItem | null {
  if (!isRecord(value) || typeof value.label !== 'string' || !value.label) {
    return null
  }
  const edit = isRecord(value.textEdit) ? value.textEdit : null
  // Why insert over replace: accepting a name mid-word should not eat the rest of the word.
  const range = edit ? readRange(edit.range ?? edit.insert) : null
  const documentation = readDocumentation(value.documentation)
  const optional = {
    kind: typeof value.kind === 'number' ? value.kind : null,
    detail: text(value.detail),
    documentation,
    sortText: text(value.sortText),
    filterText: text(value.filterText)
  }
  return {
    label: value.label,
    ...Object.fromEntries(Object.entries(optional).filter(([, entry]) => entry !== null)),
    insertText: text(edit?.newText) ?? text(value.insertText) ?? value.label,
    ...(value.insertTextFormat === 2 ? { snippet: true as const } : {}),
    ...(range ? { range } : {})
  }
}

// Why two shapes: LSP answers a completion with a CompletionList or a bare CompletionItem[].
export function readCompletions(result: unknown): LanguageServerCompletions {
  const items = Array.isArray(result) ? result : isRecord(result) ? result.items : null
  return {
    incomplete: isRecord(result) && result.isIncomplete === true,
    items: Array.isArray(items)
      ? items.flatMap((item: unknown) => {
          const read = readItem(item)
          return read ? [read] : []
        })
      : []
  }
}
