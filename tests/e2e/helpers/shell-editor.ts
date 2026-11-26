import type { Page } from '@stablyai/playwright-test'
import { expect } from '@stablyai/playwright-test'
import { getActiveTabId } from './store'

/** The active pane's buffer as trimmed lines, plus whether the terminal's own cursor is hidden. */
export async function readActiveTerminal(
  page: Page
): Promise<{ lines: string[]; cursorHidden: boolean | null }> {
  const tabId = await getActiveTabId(page)
  return page.evaluate((id) => {
    const manager = window.__paneManagers?.get(id ?? '')
    const pane = manager?.getActivePane?.() ?? manager?.getPanes?.()[0]
    type ProbedTerminal = {
      buffer: {
        active: {
          length: number
          getLine: (row: number) => { translateToString: (trim: boolean) => string } | undefined
        }
      }
      _core?: { coreService?: { isCursorHidden?: boolean } }
    }
    const terminal = pane?.terminal as ProbedTerminal | undefined
    if (!terminal) {
      return { lines: [], cursorHidden: null }
    }
    const buffer = terminal.buffer.active
    const lines: string[] = []
    for (let row = 0; row < buffer.length; row++) {
      lines.push(buffer.getLine(row)?.translateToString(true).trimEnd() ?? '')
    }
    return { lines, cursorHidden: terminal._core?.coreService?.isCursorHidden ?? null }
  }, tabId)
}

/** Waits for a whole row with this text; the serialized screen can hold style codes between rows. */
export async function waitForOutputLine(page: Page, text: string): Promise<void> {
  await expect
    .poll(async () => (await readActiveTerminal(page)).lines, { timeout: 15_000 })
    .toContain(text)
}
