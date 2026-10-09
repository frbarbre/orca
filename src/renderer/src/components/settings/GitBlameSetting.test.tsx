// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitBlameSetting } from './GitBlameSetting'
import { getGeneralEditorSearchEntries, getGeneralPaneSearchEntries } from './general-search'
import { matchesSettingsSearch } from './settings-search'

describe('GitBlameSetting', () => {
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

  it('switches blame off and keeps the "You" choice as it was', () => {
    const updateSettings = vi.fn()
    act(() =>
      root.render(
        <GitBlameSetting
          settings={{ gitBlame: { youForMyCommits: false } }}
          updateSettings={updateSettings}
        />
      )
    )

    const blame = container.querySelector<HTMLElement>('[aria-label="Show line blame"]')
    expect(blame?.getAttribute('aria-checked')).toBe('true')
    act(() => blame?.click())
    expect(updateSettings).toHaveBeenCalledWith({
      gitBlame: { youForMyCommits: false, enabled: false }
    })
  })

  it('switches "You" for my own commits', () => {
    const updateSettings = vi.fn()
    act(() => root.render(<GitBlameSetting settings={{}} updateSettings={updateSettings} />))

    const you = Array.from(container.querySelectorAll<HTMLElement>('[aria-label]')).find(
      (element) => element.getAttribute('aria-label') === 'Show "You" for my commits'
    )
    act(() => you?.click())
    expect(updateSettings).toHaveBeenCalledWith({ gitBlame: { youForMyCommits: false } })
  })

  it.each(['blame', 'git blame', 'author'])(
    'is reachable through both search gates for "%s"',
    (query) => {
      const entry = getGeneralEditorSearchEntries().find((item) => item.title === 'Git Blame')
      expect(entry).toBeDefined()
      expect(matchesSettingsSearch(query, entry!)).toBe(true)
      expect(matchesSettingsSearch(query, getGeneralPaneSearchEntries())).toBe(true)
    }
  )
})
