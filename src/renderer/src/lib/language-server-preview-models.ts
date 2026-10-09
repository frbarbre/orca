import type * as Monaco from 'monaco-editor'
import type { LanguageServerLocation } from '../../../shared/language-server'
import { detectLanguage } from '@/lib/language-detect'
import { previewModelText } from './language-server-editor'

export const PREVIEW_SCHEME = 'orca-definition'
const MAX_PREVIEW_MODELS = 80

// Why: a reference copy holds the whole file, so a definition's snippet must not overwrite it.
const wholeFileUris = new Set<string>()

function previewUri(monaco: typeof Monaco, filePath: string): Monaco.Uri {
  return monaco.Uri.file(filePath).with({ scheme: PREVIEW_SCHEME })
}

function openFileModel(monaco: typeof Monaco, filePath: string): Monaco.editor.ITextModel | null {
  return monaco.editor.getModel(monaco.Uri.file(filePath))
}

function createPreviewModel(
  monaco: typeof Monaco,
  uri: Monaco.Uri,
  text: string,
  language: string
): void {
  const previews = monaco.editor.getModels().filter((model) => model.uri.scheme === PREVIEW_SCHEME)
  for (const stale of previews.slice(0, Math.max(0, previews.length - MAX_PREVIEW_MODELS + 1))) {
    wholeFileUris.delete(stale.uri.toString())
    stale.dispose()
  }
  monaco.editor.createModel(text, language, uri)
}

// Why a model per target: standalone Monaco underlines a Cmd+hovered name and shows a peek only
// for models it already holds, and it loads none by itself.
export function definitionModelUri(
  monaco: typeof Monaco,
  location: LanguageServerLocation
): Monaco.Uri {
  const open = openFileModel(monaco, location.filePath)
  if (open) {
    return open.uri
  }
  const uri = previewUri(monaco, location.filePath)
  if (wholeFileUris.has(uri.toString())) {
    return uri
  }
  const text = previewModelText(location)
  const existing = monaco.editor.getModel(uri)
  if (!existing) {
    createPreviewModel(monaco, uri, text, 'plaintext')
  } else if (existing.getValue() !== text) {
    existing.setValue(text)
  }
  return uri
}

export function referenceModelUri(
  monaco: typeof Monaco,
  filePath: string,
  text: string | undefined
): Monaco.Uri | null {
  const open = openFileModel(monaco, filePath)
  if (open) {
    return open.uri
  }
  if (text === undefined) {
    return null
  }
  const uri = previewUri(monaco, filePath)
  const language = detectLanguage(filePath)
  const existing = monaco.editor.getModel(uri)
  if (!existing) {
    createPreviewModel(monaco, uri, text, language)
  } else {
    if (existing.getValue() !== text) {
      existing.setValue(text)
    }
    if (existing.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(existing, language)
    }
  }
  wholeFileUris.add(uri.toString())
  return uri
}

export function wordRangeAt(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel | null,
  lineNumber: number,
  column: number
): Monaco.Range {
  const word =
    model && lineNumber <= model.getLineCount()
      ? model.getWordAtPosition({ lineNumber, column })
      : null
  return word
    ? new monaco.Range(lineNumber, word.startColumn, lineNumber, word.endColumn)
    : new monaco.Range(lineNumber, column, lineNumber, column)
}
