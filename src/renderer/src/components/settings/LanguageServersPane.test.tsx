// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LANGUAGE_SERVER_LANGUAGES } from '../../../../shared/language-server'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { LanguageServersPane } from './LanguageServersPane'
import { getLanguageServersSearchEntries } from './language-servers-search'
import { matchesSettingsSearch } from './settings-search'

describe('LanguageServersPane', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(
    languageServers: GlobalSettings['languageServers'],
    updateSettings = vi.fn(),
    linters?: GlobalSettings['linters'],
    formatters?: GlobalSettings['formatters']
  ): ReturnType<typeof vi.fn> {
    act(() =>
      root.render(
        <LanguageServersPane
          settings={{ languageServers, linters, formatters }}
          updateSettings={updateSettings}
        />
      )
    )
    return updateSettings
  }

  const linterCard = (linter: string) =>
    container.querySelector<HTMLElement>(`[data-linter="${linter}"]`)

  const formatterCard = (formatter: string) =>
    container.querySelector<HTMLElement>(`[data-formatter="${formatter}"]`)

  const card = (language: string) =>
    container.querySelector<HTMLElement>(`[data-language-server="${language}"]`)

  it('shows a card with a logo for every language in the registry', () => {
    render(undefined)
    for (const language of LANGUAGE_SERVER_LANGUAGES) {
      expect(card(language)?.querySelector('img')).not.toBeNull()
    }
    expect(card('python')?.textContent).toContain('Python')
    expect(card('typescript')?.textContent).toContain('TypeScript and JavaScript')
  })

  it("restarts a language's server from its card", async () => {
    const stop = vi.fn(async () => undefined)
    vi.stubGlobal('api', { languageServer: { stop } })
    render(undefined)
    const button = card('python')?.querySelector<HTMLButtonElement>(
      'button[aria-label="Restart Language Server"]'
    )
    await act(async () => button?.click())
    expect(stop).toHaveBeenCalledWith({ language: 'python' })
    vi.unstubAllGlobals()
  })

  it('turns one language off and keeps the others as they were', () => {
    const updateSettings = render({ typescript: false })
    act(() => card('python')?.querySelector<HTMLElement>('[role="switch"]')?.click())
    expect(updateSettings).toHaveBeenCalledWith({
      languageServers: { typescript: false, python: { enabled: false, server: 'pyrefly' } }
    })
  })

  it("offers the registry's servers and saves the one picked", () => {
    const updateSettings = render(undefined)
    const options = [...(card('python')?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])]
    expect(options.map((option) => option.textContent)).toEqual([
      'pyrefly',
      'Pyright',
      'basedpyright',
      'ty'
    ])
    act(() => options[1].click())
    expect(updateSettings).toHaveBeenCalledWith({
      languageServers: { python: { enabled: true, server: 'pyright' } }
    })
  })

  it('saves a custom path when the field is left, not on every keystroke', () => {
    const updateSettings = render({ python: { server: 'pyright' } })
    const input = card('python')?.querySelector<HTMLInputElement>('input')
    expect(input?.placeholder).toContain('pyright-langserver')
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(input, '/opt/pyright/bin/pyright-langserver')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(updateSettings).not.toHaveBeenCalled()
    act(() => input?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(updateSettings).toHaveBeenCalledWith({
      languageServers: {
        python: { enabled: true, server: 'pyright', command: '/opt/pyright/bin/pyright-langserver' }
      }
    })
  })

  it('hides the server options of a language that is off', () => {
    render({ python: false })
    expect(card('python')?.querySelector('[role="radio"]')).toBeNull()
    expect(card('typescript')?.querySelector('[role="radio"]')).not.toBeNull()
  })

  it("turns a language's type errors off and keeps its server on", () => {
    const updateSettings = render(undefined)

    act(() =>
      card('python')
        ?.querySelector<HTMLElement>('[role="switch"][aria-label="Python type errors"]')
        ?.click()
    )

    expect(updateSettings).toHaveBeenCalledWith({
      languageServers: { python: { enabled: true, server: 'pyrefly', diagnostics: false } }
    })
  })

  it("turns a language's suggestions off and keeps its type errors", () => {
    const updateSettings = render({ typescript: { diagnostics: false } })

    act(() =>
      card('typescript')
        ?.querySelector<HTMLElement>(
          '[role="switch"][aria-label="TypeScript and JavaScript suggestions"]'
        )
        ?.click()
    )

    expect(updateSettings).toHaveBeenCalledWith({
      languageServers: {
        typescript: { enabled: true, server: 'tsgo', diagnostics: false, completions: false }
      }
    })
  })

  it.each(['autocomplete', 'suggestions', 'completion'])(
    'finds the suggestion switches by searching "%s"',
    (query) => {
      expect(matchesSettingsSearch(query, getLanguageServersSearchEntries())).toBe(true)
    }
  )

  it('shows type errors as on until turned off', () => {
    render({ typescript: { diagnostics: false } })
    const typeErrors = (language: string, label: string) =>
      card(language)?.querySelector(`[role="switch"][aria-label="${label} type errors"]`)

    expect(typeErrors('python', 'Python')?.getAttribute('aria-checked')).toBe('true')
    expect(
      typeErrors('typescript', 'TypeScript and JavaScript')?.getAttribute('aria-checked')
    ).toBe('false')
  })

  it.each(['type errors', 'errors'])('finds the type-error switches by searching "%s"', (query) => {
    expect(matchesSettingsSearch(query, getLanguageServersSearchEntries())).toBe(true)
  })

  it('turns oxlint off and keeps the language servers as they were', () => {
    const updateSettings = render({ typescript: false })
    expect(linterCard('oxlint')?.textContent).toContain('oxlint')

    act(() => linterCard('oxlint')?.querySelector<HTMLElement>('[role="switch"]')?.click())

    expect(updateSettings).toHaveBeenCalledWith({ linters: { oxlint: { enabled: false } } })
  })

  it("saves oxlint's path when the field is left", () => {
    const updateSettings = render(undefined, vi.fn(), { oxlint: { enabled: true } })
    const input = linterCard('oxlint')?.querySelector<HTMLInputElement>('input')
    expect(input?.placeholder).toContain('oxlint')
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(input, '/opt/bin/oxlint')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => input?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(updateSettings).toHaveBeenCalledWith({
      linters: { oxlint: { enabled: true, command: '/opt/bin/oxlint' } }
    })
  })

  it('hides the path of a linter that is off', () => {
    render(undefined, vi.fn(), { oxlint: { enabled: false } })
    expect(linterCard('oxlint')?.querySelector('input')).toBeNull()
  })

  it('turns Ruff formatting off and keeps oxfmt and the linters as they were', () => {
    const updateSettings = render(undefined, vi.fn(), { oxlint: { enabled: true } })
    expect(formatterCard('oxfmt')?.textContent).toContain('oxfmt')

    act(() => formatterCard('ruff')?.querySelector<HTMLElement>('[role="switch"]')?.click())

    expect(updateSettings).toHaveBeenCalledWith({ formatters: { ruff: { enabled: false } } })
  })

  it("saves oxfmt's path when the field is left, and hides it while oxfmt is off", () => {
    const updateSettings = render(undefined, vi.fn(), undefined, { ruff: { enabled: false } })
    expect(formatterCard('ruff')?.querySelector('input')).toBeNull()
    const input = formatterCard('oxfmt')?.querySelector<HTMLInputElement>('input')
    expect(input?.placeholder).toContain('oxfmt')

    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setValue?.call(input, '/opt/bin/oxfmt')
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => input?.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

    expect(updateSettings).toHaveBeenCalledWith({
      formatters: { ruff: { enabled: false }, oxfmt: { enabled: true, command: '/opt/bin/oxfmt' } }
    })
  })

  it.each(['format on save', 'formatter', 'ruff', 'oxfmt'])(
    'finds the formatters by searching "%s"',
    (query) => {
      expect(matchesSettingsSearch(query, getLanguageServersSearchEntries())).toBe(true)
    }
  )

  it.each(['lint', 'oxlint', 'squiggles'])('finds the linters by searching "%s"', (query) => {
    expect(matchesSettingsSearch(query, getLanguageServersSearchEntries())).toBe(true)
  })

  it.each(['language server', 'pyright', 'basedpyright', 'tsgo', 'go to definition', 'python'])(
    'can be found by searching "%s"',
    (query) => {
      expect(matchesSettingsSearch(query, getLanguageServersSearchEntries())).toBe(true)
    }
  )
})
