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
