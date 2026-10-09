// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageServersSetting } from './LanguageServersSetting'
import { getGeneralEditorSearchEntries, getGeneralPaneSearchEntries } from './general-search'
import { matchesSettingsSearch } from './settings-search'

describe('LanguageServersSetting', () => {
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

  it('turns one language off and keeps the others as they were', () => {
    const updateSettings = vi.fn()
    act(() =>
      root.render(
        <LanguageServersSetting
          settings={{ languageServers: { python: false } }}
          updateSettings={updateSettings}
        />
      )
    )

    const typescript = container.querySelector<HTMLElement>(
      '[aria-label="TypeScript and JavaScript (tsgo)"]'
    )
    expect(typescript?.getAttribute('aria-checked')).toBe('true')
    act(() => typescript?.click())
    expect(updateSettings).toHaveBeenCalledWith({
      languageServers: { python: false, typescript: false }
    })
  })

  it.each(['language server', 'pyrefly', 'tsgo', 'go to definition'])(
    'is reachable through both search gates for "%s"',
    (query) => {
      const entry = getGeneralEditorSearchEntries().find(
        (item) => item.title === 'Language Servers'
      )
      expect(entry).toBeDefined()
      expect(matchesSettingsSearch(query, entry!)).toBe(true)
      expect(matchesSettingsSearch(query, getGeneralPaneSearchEntries())).toBe(true)
    }
  )
})
