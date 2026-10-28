import type * as Monaco from 'monaco-editor'
import {
  LANGUAGE_SERVER_LANGUAGES,
  LANGUAGE_SERVERS,
  languageServerForMonacoLanguage,
  languageServerOptions,
  languageServerSettings,
  type LanguageServerLanguage,
  type LanguageServerLocation,
  type LanguageServerRequest
} from '../../../shared/language-server'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { definitionOpenTarget, toEditorPosition } from './language-server-editor'
import { fileSource } from './language-server-file-source'
import { toMonacoCompletion } from './language-server-completions'
import { RENDERER_LANGUAGE_SERVERS, type LanguageServerFallback } from './language-server-languages'
import {
  definitionModelUri,
  referenceModelUri,
  wordRangeAt
} from './language-server-preview-models'

type SourcedRequest = LanguageServerRequest & NonNullable<ReturnType<typeof fileSource>>

// Why these: the characters tsgo and pyrefly open a list on; a typed word asks on its own.
const COMPLETION_TRIGGER_CHARACTERS = ['.', '"', "'", '`', '/', '@', '<', '#']

function serverRequest(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position
): SourcedRequest | null {
  const language = languageServerForMonacoLanguage(model.getLanguageId())
  const settings = language
    ? languageServerSettings(useAppStore.getState().settings, language)
    : null
  if (!language || !settings?.enabled) {
    return null
  }
  const source = fileSource(model.uri)
  return source
    ? {
        ...source,
        language,
        server: settings.server,
        command: settings.command,
        text: model.getValue(),
        line: position.lineNumber - 1,
        character: position.column - 1
      }
    : null
}

function referenceLocations(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  request: SourcedRequest,
  locations: readonly LanguageServerLocation[],
  files: Record<string, string>
): Monaco.languages.Location[] {
  const state = useAppStore.getState()
  return locations.flatMap((location) => {
    const target = definitionOpenTarget(state, request.worktreeId, location.filePath)
    // Why the asking model for its own file: a diff side keeps its references in the diff.
    const uri =
      location.filePath === request.filePath
        ? model.uri
        : target &&
          referenceModelUri(monaco, location.filePath, files[location.filePath], {
            worktreeId: target.worktreeId,
            relativePath: target.relativePath
          })
    if (!uri) {
      return []
    }
    const { lineNumber, column } = toEditorPosition(location)
    return [{ uri, range: wordRangeAt(monaco, monaco.editor.getModel(uri), lineNumber, column) }]
  })
}

const reportedFailures = new Set<string>()

// Why once per message: hover fires constantly, and a missing server would otherwise fail silently.
function reportServerFailure(request: SourcedRequest, error: string): void {
  const key = `${request.language}:${request.server}:${error}`
  if (reportedFailures.has(key)) {
    return
  }
  reportedFailures.add(key)
  const server = languageServerOptions(request.language)[request.server]?.name ?? request.server
  toast.error(
    translate(
      'languageServers.unavailable',
      '{{server}} is unavailable ({{error}}). Install it in the project, or choose another server or its path in Settings → Language Servers.',
      { server, error }
    )
  )
}

function installLanguageProviders(
  monaco: typeof Monaco,
  languageId: string,
  fallback: LanguageServerFallback | undefined
): void {
  monaco.languages.registerDefinitionProvider(languageId, {
    provideDefinition: async (model, position) => {
      const request = serverRequest(model, position)
      if (request) {
        const result = await window.api.languageServer.definition(request)
        if (!result.ok) {
          reportServerFailure(request, result.error)
        }
        const location = result.ok ? result.locations[0] : undefined
        if (location) {
          const { lineNumber, column } = toEditorPosition(location)
          // Why the asking model for a same-file hit: the jump then stays in that editor.
          const uri =
            location.filePath === request.filePath
              ? model.uri
              : definitionModelUri(monaco, location)
          // Why the whole name: clicking a declaration then reads as "already here", and Monaco
          // shows its references instead, like VS Code.
          return {
            uri,
            range: wordRangeAt(monaco, monaco.editor.getModel(uri), lineNumber, column)
          }
        }
      }
      return fallback ? fallback.definition(model, position) : null
    }
  })

  monaco.languages.registerHoverProvider(languageId, {
    provideHover: async (model, position) => {
      const request = serverRequest(model, position)
      const result = request ? await window.api.languageServer.hover(request) : null
      if (result?.ok && result.markdown) {
        const word = model.getWordAtPosition(position)
        return {
          contents: [{ value: result.markdown }],
          range: word
            ? new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
              )
            : undefined
        }
      }
      return fallback ? fallback.hover(model, position) : null
    }
  })

  monaco.languages.registerReferenceProvider(languageId, {
    provideReferences: async (model, position) => {
      const request = serverRequest(model, position)
      if (request) {
        const result = await window.api.languageServer.references(request)
        if (result.ok) {
          return referenceLocations(monaco, model, request, result.locations, result.files)
        }
        reportServerFailure(request, result.error)
      }
      return fallback ? fallback.references(model, position) : null
    }
  })

  monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: COMPLETION_TRIGGER_CHARACTERS,
    provideCompletionItems: async (model, position, context) => {
      const language = languageServerForMonacoLanguage(model.getLanguageId())
      if (
        language &&
        !languageServerSettings(useAppStore.getState().settings, language).completions
      ) {
        return { suggestions: [] }
      }
      const request = serverRequest(model, position)
      if (request) {
        const { triggerCharacter } = context
        const result = await window.api.languageServer.completion(
          triggerCharacter ? { ...request, triggerCharacter } : request
        )
        if (result.ok) {
          const word = model.getWordUntilPosition(position)
          const wordRange = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          )
          return {
            incomplete: result.incomplete,
            suggestions: result.items.map((item) =>
              toMonacoCompletion(item, {
                kinds: monaco.languages.CompletionItemKind,
                insertAsSnippet: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                wordRange
              })
            )
          }
        }
        reportServerFailure(request, result.error)
      }
      return fallback ? fallback.completion(model, position) : { suggestions: [] }
    }
  })
}

// Why only what starts the server: the type-error and suggestion switches need no restart.
function settingsKey(language: LanguageServerLanguage): string {
  const { enabled, server, command } = languageServerSettings(
    useAppStore.getState().settings,
    language
  )
  return JSON.stringify({ enabled, server, command })
}

// Fork: hover, Cmd+click and references for every language in the registry, the same in a tab, a
// diff side or a Peek copy, since all three resolve their file through `fileSource`.
export function installLanguageServerProviders(
  monaco: typeof Monaco,
  monacoTS: typeof Monaco.typescript
): void {
  for (const language of LANGUAGE_SERVER_LANGUAGES) {
    const fallback = RENDERER_LANGUAGE_SERVERS[language].fallback?.(monaco, monacoTS)
    for (const languageId of LANGUAGE_SERVERS[language].monacoLanguageIds) {
      installLanguageProviders(monaco, languageId, fallback)
    }
  }

  // Why stop on any change: a different server, path or off switch leaves the old process idle.
  const keys = new Map(
    LANGUAGE_SERVER_LANGUAGES.map((language) => [language, settingsKey(language)])
  )
  useAppStore.subscribe((state, previous) => {
    if (state.settings === previous.settings) {
      return
    }
    for (const language of LANGUAGE_SERVER_LANGUAGES) {
      const next = settingsKey(language)
      if (keys.get(language) !== next) {
        keys.set(language, next)
        void window.api.languageServer.stop({ language })
      }
    }
  })
}
