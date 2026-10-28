import type * as Monaco from 'monaco-editor'

type DisplayPart = { text: string }
type QuickInfo = { displayParts?: readonly DisplayPart[]; documentation?: readonly DisplayPart[] }
type TextSpan = { start: number; length: number }

export function quickInfoToMarkdown(info: QuickInfo | undefined): string | null {
  const signature = (info?.displayParts ?? []).map((part) => part.text).join('')
  if (!signature.trim()) {
    return null
  }
  const docs = (info?.documentation ?? []).map((part) => part.text).join('')
  return docs
    ? `\`\`\`typescript\n${signature}\n\`\`\`\n\n${docs}`
    : `\`\`\`typescript\n${signature}\n\`\`\``
}

type CompletionEntry = { name: string; kind: string; sortText: string; insertText?: string }

type MonacoKind = keyof typeof Monaco.languages.CompletionItemKind

// TypeScript's ScriptElementKind names, by the kind Monaco draws them as.
const KIND_BY_ELEMENT: Record<string, MonacoKind> = {
  method: 'Method',
  function: 'Function',
  'local function': 'Function',
  constructor: 'Constructor',
  property: 'Property',
  getter: 'Property',
  setter: 'Property',
  var: 'Variable',
  let: 'Variable',
  const: 'Variable',
  'local var': 'Variable',
  parameter: 'Variable',
  class: 'Class',
  interface: 'Interface',
  type: 'TypeParameter',
  'type parameter': 'TypeParameter',
  enum: 'Enum',
  'enum member': 'EnumMember',
  module: 'Module',
  keyword: 'Keyword'
}

export function completionEntriesToSuggestions(
  entries: readonly CompletionEntry[],
  kinds: Partial<Record<MonacoKind, number>>,
  wordRange: Monaco.IRange
): Monaco.languages.CompletionItem[] {
  return entries.map((entry) => ({
    label: entry.name,
    kind: kinds[KIND_BY_ELEMENT[entry.kind] ?? 'Property'] ?? 0,
    sortText: entry.sortText,
    insertText: entry.insertText ?? entry.name,
    range: wordRange
  }))
}

export async function builtInTypeScriptCompletions(
  monaco: typeof Monaco,
  monacoTS: typeof Monaco.typescript,
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): Promise<Monaco.languages.CompletionList> {
  const worker = await workerFor(monacoTS, model)
  const info: { entries?: readonly CompletionEntry[] } | undefined =
    await worker.getCompletionsAtPosition(model.uri.toString(), model.getOffsetAt(position))
  if (!info?.entries || model.isDisposed()) {
    return { suggestions: [] }
  }
  const word = model.getWordUntilPosition(position)
  const wordRange = new monaco.Range(
    position.lineNumber,
    word.startColumn,
    position.lineNumber,
    word.endColumn
  )
  return {
    suggestions: completionEntriesToSuggestions(
      info.entries,
      monaco.languages.CompletionItemKind,
      wordRange
    )
  }
}

async function workerFor(monacoTS: typeof Monaco.typescript, model: Monaco.editor.ITextModel) {
  const getWorker =
    model.getLanguageId() === 'javascript'
      ? await monacoTS.getJavaScriptWorker()
      : await monacoTS.getTypeScriptWorker()
  return getWorker(model.uri)
}

function spanToRange(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  span: TextSpan
): Monaco.Range {
  const start = model.getPositionAt(span.start)
  const end = model.getPositionAt(span.start + span.length)
  return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
}

// Why by hand: this Monaco reads modeConfiguration once at setup, so the built-in hover and
// definition stay off and are called here whenever tsgo is switched off or unavailable.
export async function builtInTypeScriptHover(
  monaco: typeof Monaco,
  monacoTS: typeof Monaco.typescript,
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): Promise<Monaco.languages.Hover | null> {
  const worker = await workerFor(monacoTS, model)
  const info: (QuickInfo & { textSpan?: TextSpan }) | undefined =
    await worker.getQuickInfoAtPosition(model.uri.toString(), model.getOffsetAt(position))
  const markdown = quickInfoToMarkdown(info)
  if (!markdown || model.isDisposed()) {
    return null
  }
  return {
    contents: [{ value: markdown }],
    range: info?.textSpan ? spanToRange(monaco, model, info.textSpan) : undefined
  }
}

function openModelLocations(
  monaco: typeof Monaco,
  entries: readonly { fileName: string; textSpan: TextSpan }[]
): Monaco.languages.Location[] {
  return entries.flatMap((entry) => {
    const targetModel = monaco.editor.getModel(monaco.Uri.parse(entry.fileName))
    return targetModel
      ? [{ uri: targetModel.uri, range: spanToRange(monaco, targetModel, entry.textSpan) }]
      : []
  })
}

export async function builtInTypeScriptDefinition(
  monaco: typeof Monaco,
  monacoTS: typeof Monaco.typescript,
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): Promise<Monaco.languages.Location[] | null> {
  const worker = await workerFor(monacoTS, model)
  const entries: readonly { fileName: string; textSpan: TextSpan }[] | undefined =
    await worker.getDefinitionAtPosition(model.uri.toString(), model.getOffsetAt(position))
  return entries && !model.isDisposed() ? openModelLocations(monaco, entries) : null
}

export async function builtInTypeScriptReferences(
  monaco: typeof Monaco,
  monacoTS: typeof Monaco.typescript,
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): Promise<Monaco.languages.Location[] | null> {
  const worker = await workerFor(monacoTS, model)
  const entries: readonly { fileName: string; textSpan: TextSpan }[] | undefined =
    await worker.getReferencesAtPosition(model.uri.toString(), model.getOffsetAt(position))
  return entries && !model.isDisposed() ? openModelLocations(monaco, entries) : null
}
