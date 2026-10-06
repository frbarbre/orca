import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ElectronApplication, Locator, Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { readTerminalPaneDomLeafOrder, waitForActiveTerminalManager } from './helpers/terminal'
import { readPaneIdentitySnapshot } from './helpers/terminal-pane-identity'

const SESSION_ID = 'e2e-claude-web-session'
const BRIDGE_SESSION_ID = 'session_01E2eClaudeWebView'
const PAGE_URL = `https://claude.ai/code/${BRIDGE_SESSION_ID}`

async function writeSessionFile(
  electronApp: ElectronApplication,
  bridgeSessionId?: string
): Promise<void> {
  const home = await electronApp.evaluate(({ app }) => app.getPath('home'))
  const sessionFile = path.join(home, '.claude', 'sessions', '424242.json')
  mkdirSync(path.dirname(sessionFile), { recursive: true })
  writeFileSync(
    sessionFile,
    JSON.stringify({ sessionId: SESSION_ID, updatedAt: Date.now(), bridgeSessionId })
  )
}

async function readActivePane(orcaPage: Page): Promise<{ tabId: string; leafId: string }> {
  await waitForActiveTerminalManager(orcaPage)
  const tabId = (await readPaneIdentitySnapshot(orcaPage))?.tabId
  const [leafId] = await readTerminalPaneDomLeafOrder(orcaPage)
  expect(tabId).toBeTruthy()
  expect(leafId).toBeTruthy()
  return { tabId: tabId!, leafId: leafId! }
}

async function markPaneRunningClaude(
  orcaPage: Page,
  { tabId, leafId }: { tabId: string; leafId: string }
): Promise<void> {
  const worktreeId = await waitForActiveWorktree(orcaPage)
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
    { tabId, leafId, worktreeId, sessionId: SESSION_ID }
  )
}

async function seedClaudePane(electronApp: ElectronApplication, orcaPage: Page) {
  await waitForSessionReady(orcaPage)
  const ids = await readActivePane(orcaPage)
  await writeSessionFile(electronApp, BRIDGE_SESSION_ID)
  await markPaneRunningClaude(orcaPage, ids)
  const pane = orcaPage.locator(`.pane[data-leaf-id="${ids.leafId}"]`)
  return {
    ...ids,
    pane,
    tab: orcaPage.locator(`[data-testid="sortable-tab"][data-tab-id="${ids.tabId}"]`),
    webview: pane.locator('webview[aria-label="Claude Code on the web"]')
  }
}

async function chooseView(orcaPage: Page, menuTarget: Locator, view: string): Promise<void> {
  await menuTarget.click({ button: 'right' })
  await orcaPage.getByRole('menuitem', { name: 'View', exact: true }).click()
  await orcaPage.getByRole('menuitemradio', { name: view }).click()
  // Why: a closing menu animates out; opening the next one meanwhile shows two View triggers.
  await expect(orcaPage.getByRole('menuitem', { name: 'View', exact: true })).toHaveCount(0)
}

// Why: serve a local stand-in for claude.ai on the page's own session, so these need no network.
async function serveClaudeStandIn(electronApp: ElectronApplication, orcaPage: Page) {
  const partition = await orcaPage.evaluate(() =>
    window.api.browser.sessionResolvePartition({ profileId: null })
  )
  await electronApp.evaluate(
    ({ session, net }, { partition }) => {
      session.fromPartition(partition).protocol.handle('https', (request) => {
        if (new URL(request.url).hostname !== 'claude.ai') {
          return net.fetch(request, { bypassCustomProtocolHandlers: true })
        }
        // Why a fresh token per response: a changed token proves the page was fetched again.
        // Why the prompt arrives late: claude.ai is a SPA that draws its prompt after load.
        const html = `<!doctype html><body data-load="${crypto.randomUUID()}"><textarea id="input"></textarea><script>setTimeout(() => { const prompt = document.createElement('div'); prompt.setAttribute('data-testid', 'code-prompt-input'); prompt.setAttribute('role', 'textbox'); prompt.setAttribute('aria-label', 'Prompt'); prompt.contentEditable = 'true'; document.body.append(prompt) }, 300)</script></body>`
        return new Response(html, { headers: { 'content-type': 'text/html' } })
      })
    },
    { partition: partition! }
  )
  const inGuest = <T>(script: string): Promise<T> =>
    electronApp.evaluate(
      ({ webContents }, { script, url }) =>
        webContents
          .getAllWebContents()
          .find((contents) => contents.getType() === 'webview' && contents.getURL() === url)
          ?.executeJavaScript(script),
      { script, url: PAGE_URL }
    )
  const pressInGuest = (keyCode: string, modifiers: ('shift' | 'alt')[] = []): Promise<void> =>
    electronApp.evaluate(
      ({ webContents }, { url, keyCode, modifiers }) => {
        const guest = webContents
          .getAllWebContents()
          .find((contents) => contents.getType() === 'webview' && contents.getURL() === url)
        guest?.focus()
        guest?.sendInputEvent({
          type: 'keyDown',
          keyCode,
          modifiers: [process.platform === 'darwin' ? 'meta' : 'control', ...modifiers]
        })
      },
      { url: PAGE_URL, keyCode, modifiers }
    )
  return { inGuest, pressInGuest }
}

test('the View submenu switches a Claude Code pane between terminal and Claude web', async ({
  electronApp,
  orcaPage
}) => {
  const { pane, tab, webview } = await seedClaudePane(electronApp, orcaPage)
  await serveClaudeStandIn(electronApp, orcaPage)

  await chooseView(orcaPage, pane, 'Claude web')
  await expect(webview).toHaveAttribute('src', PAGE_URL)
  await expect(orcaPage.getByText('Switch to Claude web view')).toHaveCount(0)

  await chooseView(orcaPage, tab, 'Terminal')
  await expect(webview).toHaveCount(0)

  await writeSessionFile(electronApp, undefined)
  await chooseView(orcaPage, tab, 'Claude web')
  await expect(pane.getByText(/Remote Control is not on for this session/)).toBeVisible()
  await expect(webview).toHaveCount(0)
  await pane.getByRole('button', { name: 'Switch to terminal view' }).click()
  await expect(pane.getByText(/Remote Control is not on/)).toHaveCount(0)
})

test('Orca shortcuts reach Orca from inside the page, and Cmd+R reloads the page', async ({
  electronApp,
  orcaPage
}) => {
  const { pane, webview } = await seedClaudePane(electronApp, orcaPage)
  const { inGuest, pressInGuest } = await serveClaudeStandIn(electronApp, orcaPage)
  await chooseView(orcaPage, pane, 'Claude web')
  await expect(webview).toHaveAttribute('src', PAGE_URL)
  await expect.poll(() => inGuest<boolean>("Boolean(document.getElementById('input'))")).toBe(true)

  // Why: a single pane under the web view draws no header buttons over the page.
  await expect(orcaPage.locator('.pane-title-bar')).toHaveCount(0)

  const rightSidebarTab = (): Promise<string | undefined> =>
    orcaPage.evaluate(() => window.__store?.getState().rightSidebarTab)
  await pressInGuest('G', ['shift'])
  await expect.poll(rightSidebarTab).toBe('source-control')
  await pressInGuest('E', ['shift'])
  await expect.poll(rightSidebarTab).toBe('explorer')

  const loadToken = (): Promise<string> => inGuest<string>('document.body.dataset.load')
  const tokenBeforeReload = await loadToken()
  await pressInGuest('R')
  await expect.poll(loadToken).not.toBe(tokenBeforeReload)
})

const PROMPT_IS_FOCUSED =
  "document.activeElement?.getAttribute('data-testid') === 'code-prompt-input'"
const PROMPT_IS_DRAWN = 'Boolean(document.querySelector(\'[data-testid="code-prompt-input"]\'))'

test('focuses the prompt when the web view is opened, and restores it after a reload without stealing focus', async ({
  electronApp,
  orcaPage
}) => {
  const { tabId, leafId, pane, webview } = await seedClaudePane(electronApp, orcaPage)
  const { inGuest } = await serveClaudeStandIn(electronApp, orcaPage)
  await chooseView(orcaPage, pane, 'Claude web')
  await expect(webview).toHaveAttribute('src', PAGE_URL)
  await expect.poll(() => inGuest<boolean>(PROMPT_IS_FOCUSED)).toBe(true)

  await orcaPage.reload({ waitUntil: 'domcontentloaded' })
  await waitForSessionReady(orcaPage)
  await waitForActiveTerminalManager(orcaPage)
  // Why: the injected session lives in renderer state; a real one is re-reported by its hooks.
  await markPaneRunningClaude(orcaPage, { tabId, leafId })
  await expect(webview).toHaveAttribute('src', PAGE_URL)
  await expect.poll(() => inGuest<boolean>(PROMPT_IS_DRAWN)).toBe(true)
  // Why a pause: proving focus never arrives needs time for a wrong focus to have happened.
  await orcaPage.waitForTimeout(1_500)
  expect(await inGuest<boolean>(PROMPT_IS_FOCUSED)).toBe(false)
})

test('opens a new Claude Code tab in the web view when that is the default view', async ({
  electronApp,
  orcaPage
}) => {
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await writeSessionFile(electronApp, BRIDGE_SESSION_ID)
  const { inGuest } = await serveClaudeStandIn(electronApp, orcaPage)
  const activeTabId = (): Promise<string | null> =>
    orcaPage.evaluate(() => window.__store?.getState().activeTabId ?? null)
  const firstTabId = (await readActivePane(orcaPage)).tabId
  await orcaPage.evaluate(async (worktreeId) => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is unavailable')
    }
    await store.getState().updateSettings({ openClaudeTabsInWebView: true })
    store.getState().createTab(worktreeId)
  }, worktreeId)
  await expect.poll(activeTabId).not.toBe(firstTabId)
  const ids = await readActivePane(orcaPage)
  await markPaneRunningClaude(orcaPage, ids)

  const pane = orcaPage.locator(`.pane[data-leaf-id="${ids.leafId}"]`)
  await expect(pane.locator('webview[aria-label="Claude Code on the web"]')).toHaveAttribute(
    'src',
    PAGE_URL
  )
  await expect.poll(() => inGuest<boolean>(PROMPT_IS_FOCUSED)).toBe(true)

  // Why: an auto-opened web view once pulled its tab back, so one click on another tab didn't stick.
  await orcaPage.locator(`[data-testid="sortable-tab"][data-tab-id="${firstTabId}"]`).click()
  await expect.poll(activeTabId).toBe(firstTabId)
  await orcaPage.waitForTimeout(1_500)
  expect(await activeTabId()).toBe(firstTabId)
})
