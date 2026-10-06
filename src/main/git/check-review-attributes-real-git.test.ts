import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkReviewAttributes } from './check-review-attributes'

const tempRoots: string[] = []

async function createFixtureRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-review-attributes-'))
  tempRoots.push(root)
  const repo = path.join(root, 'repo')
  execFileSync('git', ['init', '-q', repo])
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(repo, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, contents)
  }
  return repo
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('checkReviewAttributes against real git', () => {
  it('reads root and nested .gitattributes, including removals', async () => {
    const repo = await createFixtureRepo({
      '.gitattributes': [
        'tests/** review-test',
        'docs/** review-documentation',
        'generated/** linguist-generated=true',
        '*.stories.tsx -review-test'
      ].join('\n'),
      'apps/api/.gitattributes': 'types/_generated/** linguist-generated\n'
    })

    const result = await checkReviewAttributes(repo, [
      'tests/a.ts',
      'tests/button.stories.tsx',
      'docs/guide.md',
      'generated/client.ts',
      'apps/api/types/_generated/user.py',
      'src/index.ts'
    ])

    expect(result).toEqual({
      'tests/a.ts': { 'review-test': 'set' },
      'tests/button.stories.tsx': { 'review-test': 'unset' },
      'docs/guide.md': { 'review-documentation': 'set' },
      'generated/client.ts': { 'linguist-generated': 'set' },
      'apps/api/types/_generated/user.py': { 'linguist-generated': 'set' }
    })
  })

  it('returns nothing for a repository without .gitattributes', async () => {
    const repo = await createFixtureRepo({ 'src/index.ts': '' })
    await expect(checkReviewAttributes(repo, ['src/index.ts'])).resolves.toEqual({})
  })
})
