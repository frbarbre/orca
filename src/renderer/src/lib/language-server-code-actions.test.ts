import type * as Monaco from 'monaco-editor'
import { describe, expect, it } from 'vitest'
import { toMonacoCodeActions } from './language-server-code-actions'

const resource = { path: '/repo/a.py' } as unknown as Monaco.Uri

describe('toMonacoCodeActions', () => {
  it("turns a server's quick fixes into edits of the model they were asked for", () => {
    expect(
      toMonacoCodeActions(
        [
          {
            title: 'Insert import: `from logging import getLogger`',
            preferred: true,
            edits: [
              {
                startLine: 0,
                startCharacter: 0,
                endLine: 0,
                endCharacter: 0,
                text: 'from logging import getLogger\n'
              }
            ]
          },
          { title: 'Generate variable `getLogger`', edits: [] }
        ],
        { resource, versionId: 7 }
      )
    ).toEqual([
      {
        title: 'Insert import: `from logging import getLogger`',
        kind: 'quickfix',
        isPreferred: true,
        edit: {
          edits: [
            {
              resource,
              versionId: 7,
              textEdit: {
                range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                text: 'from logging import getLogger\n'
              }
            }
          ]
        }
      },
      { title: 'Generate variable `getLogger`', kind: 'quickfix', edit: { edits: [] } }
    ])
  })

  it('marks an organize-imports action with its kind, for Shift+Alt+O', () => {
    expect(
      toMonacoCodeActions([{ title: 'Organize Imports', edits: [] }], {
        resource,
        versionId: 2,
        kind: 'source.organizeImports'
      })
    ).toEqual([{ title: 'Organize Imports', kind: 'source.organizeImports', edit: { edits: [] } }])
  })
})
