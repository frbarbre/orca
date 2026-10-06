import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { readTerminalPaneDomLeafOrder, waitForActiveTerminalManager } from './helpers/terminal'
import { readPaneIdentitySnapshot } from './helpers/terminal-pane-identity'

const SESSION_ID = 'e2e-claude-web-session'
const BRIDGE_SESSION_ID = 'session_01E2eClaudeWebView'

test('switches a Claude Code pane to its claude.ai Remote Control page and back', async ({
  electronApp,
  orcaPage
}) => {
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await waitForActiveTerminalManager(orcaPage)
  const tabId = (await readPaneIdentitySnapshot(orcaPage))?.tabId
  const [leafId] = await readTerminalPaneDomLeafOrder(orcaPage)
  expect(tabId).toBeTruthy()
  expect(leafId).toBeTruthy()

  const home = await electronApp.evaluate(({ app }) => app.getPath('home'))
  const sessionFile = path.join(home, '.claude', 'sessions', '424242.json')
  mkdirSync(path.dirname(sessionFile), { recursive: true })
  const writeSessionFile = (bridgeSessionId?: string): void =>
    writeFileSync(
      sessionFile,
      JSON.stringify({ sessionId: SESSION_ID, updatedAt: Date.now(), bridgeSessionId })
    )
  writeSessionFile(BRIDGE_SESSION_ID)

  await orcaPage.evaluate(
    ({ tabId, leafId, worktreeId, sessionId }) => {
      window.__store
        ?.getState()
        .setAgentStatus(
          `${tabId}:${leafId}`,
          { state: 'working', prompt: 'e2e', agentType: 'claude' },
          'Claude Code',
          undefined,
          { tabId, worktreeId },
          { providerSession: { key: 'session_id', id: sessionId } }
        )
    },
    { tabId: tabId!, leafId: leafId!, worktreeId, sessionId: SESSION_ID }
  )

  const pane = orcaPage.locator(`.pane[data-leaf-id="${leafId}"]`)
  await pane.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'Switch to Claude web view' }).click()

  const webview = pane.locator('webview[aria-label="Claude Code on the web"]')
  await expect(webview).toHaveAttribute('src', `https://claude.ai/code/${BRIDGE_SESSION_ID}`)

  await orcaPage.locator(`[data-testid="sortable-tab"][data-tab-id="${tabId}"]`).click({
    button: 'right'
  })
  await orcaPage.getByRole('menuitem', { name: 'Switch to terminal view' }).click()
  await expect(webview).toHaveCount(0)

  writeSessionFile(undefined)
  await orcaPage.locator(`[data-testid="sortable-tab"][data-tab-id="${tabId}"]`).click({
    button: 'right'
  })
  await orcaPage.getByRole('menuitem', { name: 'Switch to Claude web view' }).click()
  await expect(pane.getByText(/Remote Control is not on for this session/)).toBeVisible()
  await expect(webview).toHaveCount(0)
  await pane.getByRole('button', { name: 'Switch to terminal view' }).click()
  await expect(pane.getByText(/Remote Control is not on/)).toHaveCount(0)
})
