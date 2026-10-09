import { describe, expect, it } from 'vitest'
import { createMaterialIconConfigFile } from './material-icon-config-file'

function fakeFs(files: Record<string, string>) {
  return {
    exists: (path: string) => path in files,
    read: (path: string) => {
      const text = files[path]
      if (text === undefined) {
        throw new Error('ENOENT')
      }
      return text
    },
    write: (path: string, text: string) => {
      files[path] = text
    }
  }
}

const PATH = '/home/me/.orca/material-icon-theme.json'

describe('material icon config file', () => {
  it('has no settings until the file exists', () => {
    const file = createMaterialIconConfigFile({ path: PATH, ...fakeFs({}) })
    expect(file.read()).toEqual({ path: PATH, exists: false, config: {}, errors: [] })
  })

  it('reads the associations from the file', () => {
    const file = createMaterialIconConfigFile({
      path: PATH,
      ...fakeFs({
        [PATH]: '{ "material-icon-theme.folders.associations": { "djank": "server" } }'
      })
    })
    expect(file.read().config).toEqual({ folders: { associations: { djank: 'server' } } })
  })

  it('reports a file that is not valid JSON', () => {
    const file = createMaterialIconConfigFile({ path: PATH, ...fakeFs({ [PATH]: '{ nope' }) })
    const result = file.read()
    expect(result.config).toEqual({})
    expect(result.errors[0]).toMatch(/^Invalid JSON in material-icon-theme\.json/)
  })

  it('creates a starting file with the VS Code keys, and never overwrites one', () => {
    const files: Record<string, string> = {}
    const file = createMaterialIconConfigFile({ path: PATH, ...fakeFs(files) })

    file.ensure()
    expect(JSON.parse(files[PATH] ?? '')).toEqual({
      'material-icon-theme.files.associations': {},
      'material-icon-theme.folders.associations': {}
    })
    files[PATH] = '{"mine": true}'
    file.ensure()
    expect(files[PATH]).toBe('{"mine": true}')
  })
})
