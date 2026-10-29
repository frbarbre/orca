import type * as Monaco from 'monaco-editor'
import type { LanguageServerCodeAction } from '../../../shared/language-server'
import { toMonacoRange } from './language-server-completions'

export function toMonacoCodeActions(
  actions: readonly LanguageServerCodeAction[],
  {
    resource,
    versionId,
    kind = 'quickfix'
  }: { resource: Monaco.Uri; versionId: number; kind?: string }
): Monaco.languages.CodeAction[] {
  return actions.map(({ title, preferred, edits }) => ({
    title,
    kind,
    ...(preferred ? { isPreferred: true } : {}),
    // Why the version: the fix was worked out for that text, so Monaco drops it if typing moved on.
    edit: {
      edits: edits.map((edit) => ({
        resource,
        versionId,
        textEdit: { range: toMonacoRange(edit), text: edit.text }
      }))
    }
  }))
}
