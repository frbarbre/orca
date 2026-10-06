import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import {
  cleanupGoldenWorktree,
  createGoldenWorktree,
  openGoldenSourceControl
} from './helpers/golden-source-control'
import { waitForSessionReady } from './helpers/store'

const FILES: Record<string, string> = {
  '.gitattributes': 'guides/** review-documentation\n',
  'src/feature.ts': 'export const feature = 1\n',
  'src/feature.test.ts': 'export {}\n',
  'yarn.lock': '# lock\n',
  'guides/setup.txt': 'setup\n'
}

test('filters changed files by type, including .gitattributes categories', async ({
  orcaPage,
  testRepoPath,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  const fixture = createGoldenWorktree(testRepoPath, 'file-type-filter')
  registerPostElectronShutdownCleanup(async () => cleanupGoldenWorktree(testRepoPath, fixture))
  for (const [relativePath, contents] of Object.entries(FILES)) {
    const target = path.join(fixture.worktreePath, relativePath)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, contents)
  }

  await waitForSessionReady(orcaPage)
  await openGoldenSourceControl(orcaPage, testRepoPath, fixture)

  const row = (fileName: string) =>
    orcaPage.locator('[data-testid="source-control-entry"]').filter({ hasText: fileName })
  await expect(row('feature.test.ts')).toBeVisible({ timeout: 15_000 })

  const trigger = orcaPage.getByRole('button', { name: 'Filter changed files by type' })
  await expect(trigger).toHaveText('All file types')
  await trigger.click()

  const option = (name: string) => orcaPage.getByRole('menuitemcheckbox', { name })
  await expect(option('Implementation')).toBeVisible()
  await expect(option('Tests')).toBeVisible()
  await expect(option('Generated')).toBeVisible()
  // Why: guides/ only reads as documentation through .gitattributes, so this proves git was asked.
  await expect(option('Documentation')).toBeVisible()
  await expect(option('Assets')).toHaveCount(0)
  await testInfo.attach('file-type-filter-open', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })

  await option('Tests').click()
  await option('Generated').click()
  await expect(row('feature.test.ts')).toHaveCount(0)
  await expect(row('yarn.lock')).toHaveCount(0)
  await expect(row('feature.ts')).toBeVisible()
  await expect(row('setup.txt')).toBeVisible()

  await orcaPage.keyboard.press('Escape')
  await expect(trigger).toHaveText('Implementation, Documentation')
  await testInfo.attach('file-type-filter-applied', {
    body: await orcaPage.screenshot(),
    contentType: 'image/png'
  })

  await trigger.click()
  await option('Tests').click()
  await expect(row('feature.test.ts')).toBeVisible()
})
