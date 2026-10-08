import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  cleanupGoldenWorktree,
  createGoldenWorktree,
  openGoldenSourceControl
} from './helpers/golden-source-control'
import { waitForSessionReady } from './helpers/store'

test('an agent note added through the runtime shows as a bot note and can be removed', async ({
  orcaPage,
  testRepoPath,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  const fixture = createGoldenWorktree(testRepoPath, 'agent-notes')
  registerPostElectronShutdownCleanup(async () => cleanupGoldenWorktree(testRepoPath, fixture))
  const filePath = path.join(fixture.worktreePath, 'notes-target.ts')
  const lines = Array.from({ length: 12 }, (_, index) => `export const value${index} = ${index}`)
  writeFileSync(filePath, `${lines.join('\n')}\n`)
  execFileSync('git', ['add', 'notes-target.ts'], { cwd: fixture.worktreePath, stdio: 'pipe' })
  execFileSync('git', ['commit', '-m', 'Seed notes target'], {
    cwd: fixture.worktreePath,
    stdio: 'pipe'
  })
  lines[5] = "export const value5 = 'changed by the agent'"
  writeFileSync(filePath, `${lines.join('\n')}\n`)

  await orcaPage.setViewportSize({ width: 1600, height: 850 })
  await waitForSessionReady(orcaPage)
  await orcaPage.evaluate(async () => {
    await window.__store?.getState().updateSettings({ diffDefaultView: 'inline' })
  })
  await openGoldenSourceControl(orcaPage, testRepoPath, fixture)
  await orcaPage
    .locator('[data-testid="source-control-entry"]')
    .filter({ hasText: 'notes-target.ts' })
    .click()
  await expect(
    orcaPage
      .locator('.modified-in-monaco-diff-editor .view-line')
      .filter({ hasText: 'changed by the agent' })
  ).toBeVisible()

  // Why the runtime call: it is the method `orca notes add` reaches; the CLI's own parsing has unit tests.
  const added = await orcaPage.evaluate(async () => {
    const worktreeId = window.__store!.getState().activeWorktreeId!
    return window.api.runtime.call({
      method: 'agentNote.add',
      params: {
        worktree: `id:${worktreeId}`,
        filePath: 'notes-target.ts',
        line: 6,
        body: 'Changed value5 to a string, as you asked.',
        agent: 'Claude Code'
      }
    })
  })
  expect(added).toMatchObject({ ok: true })

  // Why CSS: Monaco view zones are aria-hidden, so the card has no accessible role.
  const card = orcaPage.locator('.orca-diff-comment-card[data-agent-note="true"]')
  await expect(card).toBeVisible()
  await expect(card).toContainText('Claude Code')
  await expect(card).toContainText('Agent note')
  await expect(card).toContainText('Changed value5 to a string, as you asked.')
  await expect(card.locator('[aria-label="Send notes to an agent"]')).toHaveCount(0)
  await expect(card.locator('[aria-label="Edit note"]')).toHaveCount(0)

  await expect(orcaPage.getByRole('button', { name: 'Agent notes' }).first()).toBeVisible()
  await expect(orcaPage.getByTestId('agent-notes-shelf')).toContainText('Agent notes')
  await orcaPage.screenshot({ path: testInfo.outputPath('agent-note.png') })

  await card.locator('[aria-label="Delete note"]').click()
  await expect(card).toHaveCount(0)
  await expect(orcaPage.getByTestId('agent-notes-shelf')).toHaveCount(0)
})
