import { expect, test } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { readTerminalPaneDomLeafOrder, waitForActiveTerminalManager } from './helpers/terminal'
import { readPaneIdentitySnapshot } from './helpers/terminal-pane-identity'

const SUBMIT = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter'

test('sends a fresh note to the auto-picked agent with three key presses', async ({ orcaPage }) => {
  await orcaPage.setViewportSize({ width: 1200, height: 800 })
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)

  // A Claude session in the workspace's terminal, so the send menu has one to auto-pick.
  await waitForActiveTerminalManager(orcaPage)
  const tabId = (await readPaneIdentitySnapshot(orcaPage))?.tabId
  const [leafId] = await readTerminalPaneDomLeafOrder(orcaPage)
  await orcaPage.evaluate(
    ({ tabId, leafId, worktreeId }) => {
      window.__store
        ?.getState()
        .setAgentStatus(
          `${tabId}:${leafId}`,
          { state: 'done', prompt: 'e2e', agentType: 'claude' },
          'Claude Code',
          undefined,
          { tabId, worktreeId },
          { providerSession: { key: 'session_id', id: 'e2e-note-send' } }
        )
    },
    { tabId: tabId!, leafId: leafId!, worktreeId }
  )

  await orcaPage.evaluate(async (wId) => {
    const state = window.__store!.getState()
    const worktree = Object.values(state.worktreesByRepo)
      .flat()
      .find((entry) => entry.id === wId)!
    const separator = worktree.path.includes('\\') ? '\\' : '/'
    const relative = `src${separator}note-send-keyboard.ts`
    const lines = Array.from({ length: 8 }, (_, index) => `export const line${index} = ${index}`)
    await window.api.fs.writeFile({
      filePath: `${worktree.path}${separator}${relative}`,
      content: `${lines.join('\n')}\n`
    })
    await state.updateSettings({ diffDefaultView: 'side-by-side' })
    state.openDiff(wId, `${worktree.path}${separator}${relative}`, relative, 'typescript', false)
  }, worktreeId)

  const line = orcaPage
    .locator('.modified-in-monaco-diff-editor .view-lines .view-line')
    .filter({ hasText: 'export const line3 = 3' })
    .first()
  await expect(line).toBeVisible({ timeout: 15_000 })
  // Let the filesystem watcher finish its model refresh before opening a draft in that model.
  await orcaPage.waitForTimeout(3_000)
  await line.hover({ position: { x: 4, y: 8 } })
  await orcaPage.locator('.orca-diff-comment-add-btn').click()
  const composer = orcaPage.locator('.github-markdown-composer .ProseMirror').first()
  await expect(composer).toBeFocused()
  await orcaPage.keyboard.type('Check this line')

  // 1: finish the note; its send button takes focus.
  await orcaPage.keyboard.press(SUBMIT)
  // Why CSS: Monaco view zones are aria-hidden, so the card's button has no accessible role.
  const sendButton = orcaPage.locator(
    'button.orca-diff-comment-edit[aria-label="Send notes to an agent"]'
  )
  await expect(sendButton).toBeVisible()
  await expect(sendButton).toBeFocused()

  // 2: open the menu; the auto-picked session is the highlighted first item.
  await orcaPage.keyboard.press('Enter')
  const firstItem = orcaPage.getByRole('menuitem').first()
  await expect(firstItem).toContainText('Auto-picked')
  await expect(firstItem).toBeFocused()

  // 3: send it.
  await orcaPage.keyboard.press('Enter')
  await expect(orcaPage.getByRole('menuitem')).toHaveCount(0)
})
