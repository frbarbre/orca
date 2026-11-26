import { existsSync, readFileSync } from 'node:fs'
import type { ElectronApplication } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { attachRepoAndOpenTerminal, createRestartSession } from './helpers/orca-restart'
import { ensureTerminalVisible, waitForSessionReady } from './helpers/store'
import { waitForActiveTerminalManager } from './helpers/terminal'
import { readActiveTerminal, waitForOutputLine } from './helpers/shell-editor'
import { TEST_REPO_PATH_FILE } from './global-setup'

const FIELD = '.pane:not([hidden]) [data-shell-editor-root] textarea'
const BLOCKS = '.pane:not([hidden]) [data-shell-block]'

function seededRepoPath(): string {
  const repoPath = existsSync(TEST_REPO_PATH_FILE)
    ? readFileSync(TEST_REPO_PATH_FILE, 'utf8').trim()
    : ''
  if (!repoPath || !existsSync(repoPath)) {
    throw new Error('Shell editor restart E2E requires the seeded test repo from global setup')
  }
  return repoPath
}

test.skip(process.platform === 'win32', 'the shell editor is zsh only')

test('keeps shell blocks across a quit and relaunch', async (// oxlint-disable-next-line no-empty-pattern -- this test owns both Electron launches.
{}, testInfo) => {
  test.setTimeout(240_000)
  const session = createRestartSession(testInfo)
  let firstApp: ElectronApplication | null = null
  let secondApp: ElectronApplication | null = null
  try {
    const first = await session.launch()
    firstApp = first.app
    await waitForSessionReady(first.page)
    await attachRepoAndOpenTerminal(first.page, seededRepoPath())
    await ensureTerminalVisible(first.page)
    await waitForActiveTerminalManager(first.page, 30_000)
    const field = first.page.locator(FIELD)
    await expect(field).toBeVisible({ timeout: 30_000 })
    for (const command of ['echo restart-kept', 'false']) {
      await field.fill(command)
      await field.press('Enter')
      await expect(field).toBeVisible({ timeout: 15_000 })
    }
    await expect(first.page.locator(BLOCKS)).toHaveCount(2, { timeout: 15_000 })

    await session.close(firstApp)
    firstApp = null

    const second = await session.launch()
    secondApp = second.app
    await waitForSessionReady(second.page)
    await ensureTerminalVisible(second.page)
    await waitForActiveTerminalManager(second.page, 30_000)
    await expect(second.page.locator(FIELD)).toBeVisible({ timeout: 30_000 })
    // Why: the restored look is what this guards, so the report keeps a picture of it.
    await testInfo.attach('after-relaunch', {
      body: await second.page.screenshot(),
      contentType: 'image/png'
    })

    // Why count the restored rows: quitting right after a command can save the screen without it,
    // and a block can only come back where its rows did.
    await waitForOutputLine(second.page, 'echo restart-kept')
    const restored = (await readActiveTerminal(second.page)).lines
    const expected = ['echo restart-kept', 'false'].filter((command) => restored.includes(command))
    expect(expected).toContain('echo restart-kept')
    const blocks = second.page.locator(BLOCKS)
    await expect(blocks).toHaveCount(expected.length, { timeout: 15_000 })
    if (expected.includes('false')) {
      await expect(blocks.last()).toHaveAttribute('data-failed', 'true')
    }
  } finally {
    await session.dispose(secondApp ?? firstApp ?? undefined)
  }
})
