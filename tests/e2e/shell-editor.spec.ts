import { test, expect } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { waitForActiveTerminalManager, waitForTerminalOutput } from './helpers/terminal'

const FIELD = '[data-shell-editor-root] textarea'

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
})
