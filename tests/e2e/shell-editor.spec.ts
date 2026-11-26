import { test, expect } from './helpers/orca-app'
import { readActiveTerminal, waitForOutputLine } from './helpers/shell-editor'
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

  test('keeps commands and their output together, with no terminal cursor', async ({
    orcaPage
  }) => {
    const field = orcaPage.locator(FIELD)
    await expect(field).toBeVisible({ timeout: 30_000 })
    for (const word of ['one', 'two', 'three']) {
      await field.fill(`echo ${word}`)
      await field.press('Enter')
      await waitForOutputLine(orcaPage, word)
      await expect(field).toBeVisible({ timeout: 15_000 })
    }

    const screen = await readActiveTerminal(orcaPage)
    const lines = screen.lines.slice(screen.lines.indexOf('echo one'))
    // Why the blank rows: the gap after each command, then the next block's padding and header rows.
    expect(lines.slice(0, 13)).toEqual([
      'echo one',
      '',
      'one',
      '',
      '',
      'echo two',
      '',
      'two',
      '',
      '',
      'echo three',
      '',
      'three'
    ])
    expect(screen.cursorHidden).toBe(true)
  })

  test('draws a block per command, marks failures and grows up from the input', async ({
    orcaPage
  }, testInfo) => {
    const field = orcaPage.locator(FIELD)
    await expect(field).toBeVisible({ timeout: 30_000 })
    await field.fill('echo block-ok')
    await field.press('Enter')
    await waitForOutputLine(orcaPage, 'block-ok')
    await expect(field).toBeVisible({ timeout: 15_000 })
    await field.fill('false')
    await field.press('Enter')
    await expect(field).toBeVisible({ timeout: 15_000 })

    const blocks = orcaPage.locator('.pane:not([hidden]) [data-shell-block]')
    await expect(blocks).toHaveCount(2, { timeout: 15_000 })
    await expect(blocks.nth(0)).not.toHaveAttribute('data-failed')
    await expect(blocks.nth(1)).toHaveAttribute('data-failed', 'true')
    await expect(blocks.nth(0).locator('.shell-block-label')).toHaveText(/\(\d+\.\d{3}s\)$/)

    const transform = await orcaPage
      .locator('.pane:not([hidden]) .xterm-container > .xterm')
      .first()
      .evaluate((element) => (element as HTMLElement).style.transform)
    expect(transform).toMatch(/^translateY\(\d+(\.\d+)?px\)$/)

    const paint = await orcaPage.evaluate(() => {
      const xterm = document.querySelector('.pane:not([hidden]) .xterm') as HTMLElement
      const screen = xterm.querySelector('.xterm-screen') as HTMLElement
      const label = xterm.querySelector('.shell-block-label') as HTMLElement
      const viewport = xterm.querySelector('.xterm-viewport') as HTMLElement
      return {
        labelLeft: label.getBoundingClientRect().left,
        screenLeft: screen.getBoundingClientRect().left,
        viewportBackground: getComputedStyle(viewport).backgroundColor
      }
    })
    // Why: the header starts where the command does, and the padding never shows xterm's black.
    expect(Math.abs(paint.labelLeft - paint.screenLeft)).toBeLessThan(2)
    expect(paint.viewportBackground).not.toBe('rgb(0, 0, 0)')
    // Why: blocks are visual, so the report keeps a picture of them for review.
    await testInfo.attach('blocks', { body: await orcaPage.screenshot(), contentType: 'image/png' })
  })

  for (const away of [
    { label: 'briefly', parked: false },
    { label: 'until parked', parked: true }
  ]) {
    test(`keeps its blocks after switching to another tab ${away.label}`, async ({ orcaPage }) => {
      const field = orcaPage.locator(FIELD)
      await expect(field).toBeVisible({ timeout: 30_000 })
      const blocks = orcaPage.locator('.pane:not([hidden]) [data-shell-block]')
      // Why wait per command: typing the next one while the last still runs is shell type-ahead.
      await field.fill('echo kept-one')
      await field.press('Enter')
      await waitForOutputLine(orcaPage, 'kept-one')
      await expect(blocks).toHaveCount(1, { timeout: 15_000 })
      await field.fill('false')
      await field.press('Enter')
      await expect(blocks).toHaveCount(2, { timeout: 15_000 })

      const worktreeId = await waitForActiveWorktree(orcaPage)
      const tabId = await getActiveTabId(orcaPage)
      if (away.parked) {
        await parkHiddenTabBehindDecoy(orcaPage, worktreeId, tabId!, { parkDelayMs: PARK_DELAY_MS })
      } else {
        await orcaPage.evaluate((id) => {
          const state = window.__store!.getState()
          const other = state.createTab(id, undefined, undefined, { activate: true })
          state.setActiveTab(other.id)
        }, worktreeId)
        await expect.poll(() => getActiveTabId(orcaPage)).not.toBe(tabId)
      }
      await orcaPage.evaluate((id) => window.__store?.getState().setActiveTab(id), tabId!)
      await waitForActiveTerminalManager(orcaPage, 30_000)

      // Why count the restored rows: a parked tab's saved screen can trail its last write by a
      // command, and a block can only come back where its rows did.
      await waitForOutputLine(orcaPage, 'echo kept-one')
      const restored = (await readActiveTerminal(orcaPage)).lines
      const expected = ['echo kept-one', 'false'].filter((command) => restored.includes(command))
      await expect(blocks).toHaveCount(expected.length, { timeout: 15_000 })
      if (expected.includes('false')) {
        await expect(blocks.last()).toHaveAttribute('data-failed', 'true')
      }
      await expect(blocks.nth(0).locator('.shell-block-label')).toContainText('git:(')
      // Why: coming back to a tab puts the caret in its shell's input, not in the terminal.
      await expect(orcaPage.locator(FIELD).first()).toBeFocused({ timeout: 10_000 })
    })
  }

  test('copies a block’s output from its menu', async ({ electronApp, orcaPage }) => {
    const field = orcaPage.locator(FIELD)
    await expect(field).toBeVisible({ timeout: 30_000 })
    await field.fill('echo copy-$((6 * 7))')
    await field.press('Enter')
    await waitForOutputLine(orcaPage, 'copy-42')
    await expect(field).toBeVisible({ timeout: 15_000 })

    const block = orcaPage.locator('.pane:not([hidden]) [data-shell-block]').last()
    await block.locator('.shell-block-menu-button').click()
    await orcaPage.getByRole('menuitem', { name: 'Copy output' }).click()
    await expect
      .poll(() => electronApp.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe('copy-42')

    // Why: reopening while the first menu still animates out hands its items to the old menu.
    await expect(orcaPage.getByRole('menu')).toHaveCount(0)
    await block.locator('.shell-block-menu-button').click()
    await orcaPage.getByRole('menuitem', { name: 'Copy command and output' }).click()
    await expect
      .poll(() => electronApp.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe('echo copy-$((6 * 7))\ncopy-42')
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
