import type * as Monaco from 'monaco-editor'
import {
  languageServerForMonacoLanguage,
  languageServerSettings,
  type LanguageServerRequest
} from '../../../shared/language-server'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { toMonacoCodeActions } from './language-server-code-actions'

// Why this kind: Monaco's Shift+Alt+O asks for it and applies the one action it gets back.
const ORGANIZE_IMPORTS = 'source.organizeImports'

type ServerAccess<R extends LanguageServerRequest> = {
  serverRequest: (model: Monaco.editor.ITextModel, position: Monaco.Position) => R | null
  reportFailure: (request: R, error: string) => void
}

function featureOn(
  model: Monaco.editor.ITextModel,
  feature: 'quickFixes' | 'organizeImports'
): boolean {
  const language = languageServerForMonacoLanguage(model.getLanguageId())
  return (
    language !== null && languageServerSettings(useAppStore.getState().settings, language)[feature]
  )
}

async function organizeImports<R extends LanguageServerRequest>(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  { serverRequest, reportFailure }: ServerAccess<R>
): Promise<Monaco.languages.CodeAction[]> {
  const request = featureOn(model, 'organizeImports') ? serverRequest(model, position) : null
  const versionId = model.getVersionId()
  const result = request ? await window.api.languageServer.organizeImports(request) : null
  if (request && result && !result.ok) {
    reportFailure(request, result.error)
  }
  const title = translate('languageServers.organizeImports', 'Organize imports')
  return result?.ok && result.edits.length > 0
    ? toMonacoCodeActions([{ title, edits: result.edits }], {
        resource: model.uri,
        versionId,
        kind: ORGANIZE_IMPORTS
      })
    : []
}

async function quickFixes<R extends LanguageServerRequest>(
  model: Monaco.editor.ITextModel,
  range: Monaco.Range,
  context: Monaco.languages.CodeActionContext,
  { serverRequest }: ServerAccess<R>
): Promise<Monaco.languages.CodeAction[]> {
  // Why only on a squiggle: Monaco asks on every cursor move, and the fixes answer errors.
  const request =
    context.markers.length > 0 && featureOn(model, 'quickFixes')
      ? serverRequest(model, range.getStartPosition())
      : null
  const versionId = model.getVersionId()
  const result = request
    ? await window.api.languageServer.codeActions({
        ...request,
        endLine: range.endLineNumber - 1,
        endCharacter: range.endColumn - 1
      })
    : null
  return result?.ok ? toMonacoCodeActions(result.actions, { resource: model.uri, versionId }) : []
}

// Fork: quick fixes on a squiggle (like adding a missing import) and Shift+Alt+O.
export function installCodeActionProvider<R extends LanguageServerRequest>(
  monaco: typeof Monaco,
  languageId: string,
  access: ServerAccess<R>
): void {
  monaco.languages.registerCodeActionProvider(
    languageId,
    {
      provideCodeActions: async (model, range, context) => ({
        actions: context.only?.startsWith(ORGANIZE_IMPORTS)
          ? await organizeImports(model, range.getStartPosition(), access)
          : await quickFixes(model, range, context, access),
        dispose: () => {}
      })
    },
    { providedCodeActionKinds: ['quickfix', ORGANIZE_IMPORTS] }
  )
}
