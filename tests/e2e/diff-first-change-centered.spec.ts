import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  cleanupGoldenWorktree,
  createGoldenWorktree,
  openGoldenSourceControl
} from './helpers/golden-source-control'
import { waitForSessionReady } from './helpers/store'

const FILES = ['alpha.ts', 'beta.ts', 'gamma.ts', 'delta.ts']
const CHANGED_LINE = 150

function fileContent(name: string, changed: boolean): string {
  return Array.from({ length: 220 }, (_, index) =>
    index + 1 === CHANGED_LINE && changed
      ? `export const ${name.replace('.ts', '')}Changed = 'single line change'`
      : `export const ${name.replace('.ts', '')}${index + 1} = ${index + 1}`
  ).join('\n')
}

async function changedLineOffsetFromMiddle(page: Page, name: string): Promise<number | null> {
  return page.evaluate(
    (marker) => {
      const editor = document.querySelector('.modified-in-monaco-diff-editor')
      const line = Array.from(editor?.querySelectorAll('.view-line') ?? []).find((element) =>
        element.textContent?.includes(marker)
      )
      if (!editor || !line) {
        return null
      }
      const editorBox = editor.getBoundingClientRect()
      const lineBox = line.getBoundingClientRect()
      return Math.round(lineBox.top + lineBox.height / 2 - (editorBox.top + editorBox.height / 2))
    },
    `${name.replace('.ts', '')}Changed`
  )
}

test('opening each changed file centres its single-line change', async ({
  orcaPage,
  testRepoPath,
  registerPostElectronShutdownCleanup
}) => {
  const fixture = createGoldenWorktree(testRepoPath, 'diff-first-change-centered')
  registerPostElectronShutdownCleanup(async () => cleanupGoldenWorktree(testRepoPath, fixture))
  for (const name of FILES) {
    writeFileSync(path.join(fixture.worktreePath, name), fileContent(name, false))
  }
  execFileSync('git', ['add', ...FILES], { cwd: fixture.worktreePath, stdio: 'pipe' })
  execFileSync('git', ['commit', '-m', 'Seed long files'], {
    cwd: fixture.worktreePath,
    stdio: 'pipe'
  })
  for (const name of FILES) {
    writeFileSync(path.join(fixture.worktreePath, name), fileContent(name, true))
  }

  await orcaPage.setViewportSize({ width: 1600, height: 850 })
  await waitForSessionReady(orcaPage)
  await orcaPage.evaluate(async () => {
    await window.__store?.getState().updateSettings({ diffDefaultView: 'inline' })
  })
  await openGoldenSourceControl(orcaPage, testRepoPath, fixture)
  const entries = orcaPage.locator('[data-testid="source-control-entry"]')

  for (const name of FILES) {
    await entries.filter({ hasText: name }).click()
    // Why a settle wait: a later layout pass is what moved the change off-centre, so read after it.
    await expect
      .poll(() => changedLineOffsetFromMiddle(orcaPage, name), {
        message: `${name}'s change should be on screen`
      })
      .not.toBeNull()
    await orcaPage.waitForTimeout(1_000)
    const offset = await changedLineOffsetFromMiddle(orcaPage, name)
    expect(
      Math.abs(offset ?? Infinity),
      `${name}'s change is ${offset}px from the middle`
    ).toBeLessThan(60)
  }
})
