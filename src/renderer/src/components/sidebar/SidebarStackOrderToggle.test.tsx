// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarStackOrderToggle } from './SidebarStackOrderToggle'

const roots: Root[] = []

async function renderToggle(setStackOrder: (order: 'asc' | 'desc') => void) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<SidebarStackOrderToggle stackOrder="desc" setStackOrder={setStackOrder} />)
  })
  return container
}

describe('SidebarStackOrderToggle', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      act(() => root.unmount())
    })
    document.body.replaceChildren()
  })

  it('switches the stack order to ascending', async () => {
    const setStackOrder = vi.fn()
    const container = await renderToggle(setStackOrder)
    const ascending = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Asc')
    )

    await act(async () => {
      ascending?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })

    expect(setStackOrder).toHaveBeenCalledWith('asc')
  })

  it('marks the current order as selected', async () => {
    const container = await renderToggle(vi.fn())
    const pressed = container.querySelector('[data-state="on"]')

    expect(pressed?.textContent).toContain('Desc')
  })
})
