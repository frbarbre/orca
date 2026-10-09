import { describe, expect, it } from 'vitest'
import { readMaterialIconConfig } from './material-icon-config'

describe('readMaterialIconConfig', () => {
  it("reads VS Code's settings.json keys, so they can be pasted as they are", () => {
    expect(
      readMaterialIconConfig({
        'material-icon-theme.activeIconPack': 'react',
        'material-icon-theme.folders.theme': 'classic',
        'material-icon-theme.folders.associations': { djank: 'server' },
        'material-icon-theme.files.associations': {
          '*.sample': 'markdown',
          'fixtures.py': 'test-js'
        },
        'material-icon-theme.languages.associations': { jinja: 'html' },
        'editor.fontSize': 14
      })
    ).toEqual({
      config: {
        activeIconPack: 'react',
        folders: { theme: 'classic', associations: { djank: 'server' } },
        files: { associations: { '*.sample': 'markdown', 'fixtures.py': 'test-js' } },
        languages: { associations: { jinja: 'html' } }
      },
      errors: []
    })
  })

  it('reads the same settings nested', () => {
    expect(
      readMaterialIconConfig({ folders: { associations: { djank: 'server' } } }).config
    ).toEqual({ folders: { associations: { djank: 'server' } } })
  })

  it('keeps the valid settings and reports the broken ones', () => {
    const result = readMaterialIconConfig({
      'material-icon-theme.files.associations': { good: 'python', bad: 3 },
      'material-icon-theme.folders.theme': 'rainbow'
    })
    expect(result.config).toEqual({ files: { associations: { good: 'python' } } })
    expect(result.errors).toEqual([
      'files.associations.bad must name an icon.',
      'folders.theme must be "specific", "classic" or "none".'
    ])
  })

  it('reports a file that is not a JSON object', () => {
    expect(readMaterialIconConfig([1, 2])).toEqual({
      config: {},
      errors: ['The icon settings file must contain a JSON object.']
    })
  })
})
