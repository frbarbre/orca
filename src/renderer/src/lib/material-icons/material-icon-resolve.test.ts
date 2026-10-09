import { describe, expect, it } from 'vitest'
import { fileIconName, folderIconName } from './material-icon-resolve'

const manifest = {
  file: 'file',
  folder: 'folder',
  folderExpanded: 'folder-open',
  fileNames: { 'package.json': 'nodejs', dockerfile: 'docker' },
  fileExtensions: {
    ts: 'typescript',
    'test.ts': 'test-ts',
    'd.ts': 'typescript-def',
    py: 'python'
  },
  folderNames: { src: 'folder-src', tests: 'folder-test' },
  folderNamesExpanded: { src: 'folder-src-open', tests: 'folder-test-open' },
  light: {
    fileExtensions: { py: 'python_light' },
    folderNames: { src: 'folder-src_light' }
  }
}

describe('fileIconName', () => {
  it('matches a whole file name before its extension, ignoring case', () => {
    expect(fileIconName(manifest, 'apps/frontend/package.json', false)).toBe('nodejs')
    expect(fileIconName(manifest, 'Dockerfile', false)).toBe('docker')
  })

  it('prefers the longest extension, like VS Code', () => {
    expect(fileIconName(manifest, 'src/a.test.ts', false)).toBe('test-ts')
    expect(fileIconName(manifest, 'src/types.d.ts', false)).toBe('typescript-def')
    expect(fileIconName(manifest, 'src/a.ts', false)).toBe('typescript')
  })

  it('falls back to the plain file icon', () => {
    expect(fileIconName(manifest, 'notes.unknownext', false)).toBe('file')
    expect(fileIconName(manifest, '', false)).toBe('file')
  })

  it('uses the light variant on a light theme', () => {
    expect(fileIconName(manifest, 'scope.py', true)).toBe('python_light')
    expect(fileIconName(manifest, 'a.ts', true)).toBe('typescript')
  })
})

describe('folderIconName', () => {
  it('picks the named folder icon, open or closed', () => {
    expect(folderIconName(manifest, 'apps/frontend/src', false, false)).toBe('folder-src')
    expect(folderIconName(manifest, 'Tests', true, false)).toBe('folder-test-open')
  })

  it('falls back to the plain folder icon', () => {
    expect(folderIconName(manifest, 'djank', false, false)).toBe('folder')
    expect(folderIconName(manifest, 'djank', true, false)).toBe('folder-open')
  })

  it('uses the light variant on a light theme', () => {
    expect(folderIconName(manifest, 'src', false, true)).toBe('folder-src_light')
  })
})
