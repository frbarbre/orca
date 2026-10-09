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

export async function builtInTypeScriptDefinition(
  monaco: typeof Monaco,
  monacoTS: typeof Monaco.typescript,
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): Promise<Monaco.languages.Location[] | null> {
  const worker = await workerFor(monacoTS, model)
  const entries: readonly { fileName: string; textSpan: TextSpan }[] | undefined =
    await worker.getDefinitionAtPosition(model.uri.toString(), model.getOffsetAt(position))
  if (!entries || model.isDisposed()) {
    return null
  }
  return entries.flatMap((entry) => {
    const targetModel = monaco.editor.getModel(monaco.Uri.parse(entry.fileName))
    return targetModel
      ? [{ uri: targetModel.uri, range: spanToRange(monaco, targetModel, entry.textSpan) }]
      : []
  })
}
