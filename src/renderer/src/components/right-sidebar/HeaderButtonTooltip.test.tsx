// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { formatOptionalPrimaryShortcutLabel } from '@/hooks/useShortcutLabel'

const mocks = vi.hoisted(() => ({ keybindings: {} as Record<string, string[]> }))

vi.mock('@/store', () => {
  const state = () => ({ keybindings: mocks.keybindings })
  return { useAppStore: (select: (s: ReturnType<typeof state>) => unknown) => select(state()) }
})

import { HeaderButtonTooltip } from './HeaderButtonTooltip'

function renderTooltip(shortcut?: 'workspace.openFrontend') {
  render(
    <TooltipProvider>
      <HeaderButtonTooltip label="Open Frontend" shortcut={shortcut}>
        <button type="button">open</button>
      </HeaderButtonTooltip>
    </TooltipProvider>
  )
  fireEvent.focus(screen.getByRole('button', { name: 'open' }))
}

afterEach(() => {
  cleanup()
  mocks.keybindings = {}
})

describe('HeaderButtonTooltip', () => {
  it("shows the action's shortcut beside the label", async () => {
    renderTooltip('workspace.openFrontend')

    const shortcut = formatOptionalPrimaryShortcutLabel('workspace.openFrontend', {})
    expect(shortcut).toBeTruthy()
    expect((await screen.findByRole('tooltip')).textContent).toBe(`Open Frontend${shortcut}`)
  })

  it('shows only the label when the action is unbound', async () => {
    mocks.keybindings = { 'workspace.openFrontend': [] }
    renderTooltip('workspace.openFrontend')

    expect((await screen.findByRole('tooltip')).textContent).toBe('Open Frontend')
  })
})
