import type { editor, IDisposable } from 'monaco-editor'
import { translate } from '@/i18n/i18n'
import {
  languageServerForMonacoLanguage,
  restartLanguageServers
} from '@/lib/restart-language-servers'

type DiffEditorPanes = {
  getOriginalEditor: () => editor.IStandaloneCodeEditor
  getModifiedEditor: () => editor.IStandaloneCodeEditor
}

export function addRestartLanguageServerAction(
  codeEditor: editor.IStandaloneCodeEditor
): IDisposable {
  return codeEditor.addAction({
    id: 'orca.restartLanguageServer',
    label: translate('languageServers.restartAction', 'Restart Language Server'),
    contextMenuGroupId: 'navigation',
    contextMenuOrder: 3,
    run: () => {
      const language = languageServerForMonacoLanguage(codeEditor.getModel()?.getLanguageId() ?? '')
      void restartLanguageServers(language ? [language] : undefined)
    }
  })
}

export function installDiffEditorRestartLanguageServerAction(
  diffEditor: DiffEditorPanes
): () => void {
  const originalAction = addRestartLanguageServerAction(diffEditor.getOriginalEditor())
  const modifiedAction = addRestartLanguageServerAction(diffEditor.getModifiedEditor())
  return () => {
    originalAction.dispose()
    modifiedAction.dispose()
  }
}
