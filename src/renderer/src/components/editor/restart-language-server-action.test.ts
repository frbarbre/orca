import { describe, expect, it, vi } from 'vitest'
import type { editor } from 'monaco-editor'

const restartLanguageServers = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/lib/restart-language-servers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  restartLanguageServers
}))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

import { installDiffEditorRestartLanguageServerAction } from './restart-language-server-action'

function createPane(languageId: string) {
  const actions: editor.IActionDescriptor[] = []
  const dispose = vi.fn()
  const pane = {
    addAction: (descriptor: editor.IActionDescriptor) => {
      actions.push(descriptor)
      return { dispose }
    },
    getModel: () => ({ getLanguageId: () => languageId })
  }
  return { pane: pane as unknown as editor.ICodeEditor, actions, dispose }
}

describe('installDiffEditorRestartLanguageServerAction', () => {
  it('adds Restart Language Server to the context menu of both diff panes', () => {
    const original = createPane('typescript')
    const modified = createPane('python')

    installDiffEditorRestartLanguageServerAction({
      getOriginalEditor: () => original.pane,
      getModifiedEditor: () => modified.pane
    })

    for (const { actions } of [original, modified]) {
      expect(actions).toEqual([
        expect.objectContaining({
          id: 'orca.restartLanguageServer',
          label: 'Restart Language Server',
          contextMenuGroupId: 'navigation'
        })
      ])
    }
  })

  it('restarts the server for the language of the pane it was run from, and disposes both', () => {
    const original = createPane('typescript')
    const modified = createPane('python')

    const dispose = installDiffEditorRestartLanguageServerAction({
      getOriginalEditor: () => original.pane,
      getModifiedEditor: () => modified.pane
    })
    void modified.actions[0].run(modified.pane)

    expect(restartLanguageServers).toHaveBeenCalledWith(['python'])
    dispose()
    expect(original.dispose).toHaveBeenCalled()
    expect(modified.dispose).toHaveBeenCalled()
  })
})
