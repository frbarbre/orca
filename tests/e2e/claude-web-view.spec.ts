import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { readTerminalPaneDomLeafOrder, waitForActiveTerminalManager } from './helpers/terminal'
import { readPaneIdentitySnapshot } from './helpers/terminal-pane-identity'

const SESSION_ID = 'e2e-claude-web-session'
const BRIDGE_SESSION_ID = 'session_01E2eClaudeWebView'
const PAGE_URL = `https://claude.ai/code/${BRIDGE_SESSION_ID}`

async function seedClaudePane(electronApp: ElectronApplication, orcaPage: Page) {
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
  const tab = orcaPage.locator(`[data-testid="sortable-tab"][data-tab-id="${tabId}"]`)
  const webview = pane.locator('webview[aria-label="Claude Code on the web"]')
  return { pane, tab, webview, writeSessionFile }
}

test('switches a Claude Code pane to its claude.ai Remote Control page and back', async ({
  electronApp,
  orcaPage
}) => {
  const { pane, tab, webview, writeSessionFile } = await seedClaudePane(electronApp, orcaPage)

  await pane.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'Switch to Claude web view' }).click()
  await expect(webview).toHaveAttribute('src', PAGE_URL)

  await tab.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'Switch to terminal view' }).click()
  await expect(webview).toHaveCount(0)

  writeSessionFile(undefined)
  await tab.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'Switch to Claude web view' }).click()
  await expect(pane.getByText(/Remote Control is not on for this session/)).toBeVisible()
  await expect(webview).toHaveCount(0)
  await pane.getByRole('button', { name: 'Switch to terminal view' }).click()
  await expect(pane.getByText(/Remote Control is not on/)).toHaveCount(0)
})

test('the reload shortcut reloads the claude.ai page, with no toolbar over it', async ({
  electronApp,
  orcaPage
}) => {
  const { pane, webview } = await seedClaudePane(electronApp, orcaPage)
  const partition = await orcaPage.evaluate(() =>
    window.api.browser.sessionResolvePartition({ profileId: null })
  )
  // Why: serve a local stand-in for claude.ai on the page's own session, so the test needs no network.
  await electronApp.evaluate(
    ({ session, net }, { partition }) => {
      session.fromPartition(partition).protocol.handle('https', (request) => {
        if (new URL(request.url).hostname !== 'claude.ai') {
          return net.fetch(request, { bypassCustomProtocolHandlers: true })
        }
        // Why a fresh token per response: a changed token proves the page was fetched again.
        const html = `<!doctype html><body data-load="${crypto.randomUUID()}"><textarea id="input"></textarea></body>`
        return new Response(html, { headers: { 'content-type': 'text/html' } })
      })
    },
    { partition: partition! }
  )
  await pane.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'Switch to Claude web view' }).click()
  await expect(webview).toHaveAttribute('src', PAGE_URL)

  const inGuest = <T>(script: string): Promise<T> =>
    electronApp.evaluate(
      ({ webContents }, { script, url }) =>
        webContents
          .getAllWebContents()
          .find((contents) => contents.getType() === 'webview' && contents.getURL() === url)
          ?.executeJavaScript(script),
      { script, url: PAGE_URL }
    )
  await expect.poll(() => inGuest<boolean>("Boolean(document.getElementById('input'))")).toBe(true)
  // Why typed text: a reload clears it, so its absence proves the page itself reloaded.
  await inGuest("document.getElementById('input').value = 'before reload'")
  const loadToken = (): Promise<string> => inGuest<string>('document.body.dataset.load')
  const tokenBeforeReload = await loadToken()
  await electronApp.evaluate(({ webContents }, url) => {
    const guest = webContents
      .getAllWebContents()
      .find((contents) => contents.getType() === 'webview' && contents.getURL() === url)
    guest?.focus()
    guest?.sendInputEvent({
      type: 'keyDown',
      keyCode: 'R',
      modifiers: [process.platform === 'darwin' ? 'meta' : 'control']
    })
  }, PAGE_URL)
  await expect.poll(loadToken).not.toBe(tokenBeforeReload)
  await expect.poll(() => inGuest<string>("document.getElementById('input')?.value")).toBe('')
  await expect(pane.getByText('Claude web view')).toHaveCount(0)
})
