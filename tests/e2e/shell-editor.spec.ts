import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  ensureTerminalVisible,
  getActiveTabId,
  waitForActiveWorktree,
  waitForSessionReady
} from './helpers/store'
import { waitForActiveTerminalManager, waitForTerminalOutput } from './helpers/terminal'
import { parkHiddenTabBehindDecoy } from './helpers/terminal-hidden-parking'

const FIELD = '[data-shell-editor-root] textarea'
const PARK_DELAY_MS = 2_000

// Why: parking is what rebuilds a hidden tab's terminal, and only runs in e2e with a delay set.
test.use({ orcaAppExtraEnv: { ORCA_E2E_TERMINAL_PARKING_DELAY_MS: String(PARK_DELAY_MS) } })

/** The active pane's buffer as trimmed lines, plus whether the terminal's own cursor is hidden. */
async function readActiveTerminal(
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

test.describe('shell editor', () => {
  test.skip(process.platform === 'win32', 'the shell editor is zsh only')

  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
    await ensureTerminalVisible(orcaPage)
    await waitForActiveTerminalManager(orcaPage, 30_000)
  })

  test('docks under the zsh prompt, runs what is typed and comes back', async ({ orcaPage }) => {
    const field = orcaPage.locator(FIELD)
    await expect(field).toBeVisible({ timeout: 30_000 })

    await field.fill('echo shell-editor-$((40 + 2))')
    await field.press('Enter')

    await waitForTerminalOutput(orcaPage, 'shell-editor-42', 15_000)
    await expect(field).toBeVisible({ timeout: 15_000 })
    await expect(field).toHaveValue('')
  })

  test('keeps commands and their output together, with no terminal cursor', async ({
    orcaPage
  }) => {
    const field = orcaPage.locator(FIELD)
    await expect(field).toBeVisible({ timeout: 30_000 })
    for (const word of ['one', 'two', 'three']) {
      await field.fill(`echo ${word}`)
      await field.press('Enter')
      await waitForTerminalOutput(orcaPage, `\n${word}`, 15_000)
      await expect(field).toBeVisible({ timeout: 15_000 })
    }

    const screen = await readActiveTerminal(orcaPage)
    const lines = screen.lines.slice(screen.lines.indexOf('echo one'))
    expect(lines.slice(0, 6)).toEqual(['echo one', 'one', 'echo two', 'two', 'echo three', 'three'])
    expect(screen.cursorHidden).toBe(true)
  })

  test('is back after its tab was parked and shown again', async ({ orcaPage }) => {
    const field = orcaPage.locator(FIELD)
    await expect(field).toBeVisible({ timeout: 30_000 })
    const worktreeId = await waitForActiveWorktree(orcaPage)
    const tabId = await getActiveTabId(orcaPage)
    expect(tabId).toBeTruthy()

    await parkHiddenTabBehindDecoy(orcaPage, worktreeId, tabId!, { parkDelayMs: PARK_DELAY_MS })
    await orcaPage.evaluate((id) => window.__store?.getState().setActiveTab(id), tabId!)
    await waitForActiveTerminalManager(orcaPage, 30_000)

    const shownField = orcaPage.locator(`.pane:not([hidden]) ${FIELD}`).first()
    await expect(shownField).toBeVisible({ timeout: 15_000 })
    await shownField.fill('echo parked-$((20 + 1))')
    await shownField.press('Enter')
    await waitForTerminalOutput(orcaPage, 'parked-21', 15_000)
  })
})
