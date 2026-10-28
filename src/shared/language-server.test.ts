import { describe, expect, it } from 'vitest'
import {
  LANGUAGE_SERVER_LANGUAGES,
  LANGUAGE_SERVERS,
  languageServerForFile,
  languageServerForMonacoLanguage,
  languageServerSettings
} from './language-server'

describe('language server registry', () => {
  it('lists every registered language', () => {
    expect(LANGUAGE_SERVER_LANGUAGES).toEqual(Object.keys(LANGUAGE_SERVERS))
  })

  it("finds a file's server and the language id that server expects", () => {
    expect(languageServerForFile('/repo/app.py')).toEqual({
      language: 'python',
      lspLanguageId: 'python'
    })
    expect(languageServerForFile('/repo/stubs/os.PYI')).toEqual({
      language: 'python',
      lspLanguageId: 'python'
    })
    expect(languageServerForFile('/repo/a.tsx')).toEqual({
      language: 'typescript',
      lspLanguageId: 'typescriptreact'
    })
    expect(languageServerForFile('/repo/a.mts')).toEqual({
      language: 'typescript',
      lspLanguageId: 'typescript'
    })
    expect(languageServerForFile('/repo/a.cjs')).toEqual({
      language: 'typescript',
      lspLanguageId: 'javascript'
    })
    expect(languageServerForFile('/repo/a.jsx')).toEqual({
      language: 'typescript',
      lspLanguageId: 'javascriptreact'
    })
    expect(languageServerForFile('/repo/main.go')).toBeNull()
    expect(languageServerForFile('/repo/Makefile')).toBeNull()
  })

  it('offers each language a choice of servers with a default among them', () => {
    for (const language of LANGUAGE_SERVER_LANGUAGES) {
      const { servers, defaultServer } = LANGUAGE_SERVERS[language]
      expect(Object.keys(servers)).toContain(defaultServer)
    }
    expect(Object.keys(LANGUAGE_SERVERS.python.servers)).toEqual([
      'pyrefly',
      'pyright',
      'basedpyright',
      'ty'
    ])
  })

  it("reads a language's settings, including the older on/off switch", () => {
    expect(languageServerSettings(null, 'python')).toEqual({
      enabled: true,
      server: 'pyrefly',
      command: null,
      diagnostics: true,
      completions: true
    })
    expect(languageServerSettings({ languageServers: { python: false } }, 'python')).toEqual({
      enabled: false,
      server: 'pyrefly',
      command: null,
      diagnostics: true,
      completions: true
    })
    expect(
      languageServerSettings(
        {
          languageServers: { python: { server: 'pyright', command: ' /opt/pyright-langserver ' } }
        },
        'python'
      )
    ).toEqual({
      enabled: true,
      server: 'pyright',
      command: '/opt/pyright-langserver',
      diagnostics: true,
      completions: true
    })
    expect(
      languageServerSettings(
        {
          languageServers: {
            typescript: {
              enabled: false,
              server: 'gone',
              command: '',
              diagnostics: false,
              completions: false
            }
          }
        },
        'typescript'
      )
    ).toEqual({
      enabled: false,
      server: 'tsgo',
      command: null,
      diagnostics: false,
      completions: false
    })
  })

  it("finds the server for an editor's language id", () => {
    expect(languageServerForMonacoLanguage('python')).toBe('python')
    expect(languageServerForMonacoLanguage('typescript')).toBe('typescript')
    expect(languageServerForMonacoLanguage('javascript')).toBe('typescript')
    expect(languageServerForMonacoLanguage('markdown')).toBeNull()
  })
})
