import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeWorkspaceActionSkills } from './write-workspace-action-skills'

describe('writeWorkspaceActionSkills', () => {
  let home: string
  let roots: string[]

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'orca-action-skills-'))
    roots = [join(home, '.claude', 'skills'), join(home, '.agents', 'skills')]
  })

  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
  })

  it('writes each skill into every root and rewrites it when the prompt changes', async () => {
    await writeWorkspaceActionSkills([{ name: 'orca-create-pr', content: 'first' }], roots)
    await writeWorkspaceActionSkills([{ name: 'orca-create-pr', content: 'second' }], roots)
    for (const root of roots) {
      expect(readFileSync(join(root, 'orca-create-pr', 'SKILL.md'), 'utf8')).toBe('second')
    }
  })

  it('leaves a folder of the same name that Orca did not write', async () => {
    const own = join(roots[0], 'orca-review-pr')
    mkdirSync(own, { recursive: true })
    writeFileSync(join(own, 'SKILL.md'), 'mine')
    await writeWorkspaceActionSkills([{ name: 'orca-review-pr', content: 'orca' }], roots)
    expect(readFileSync(join(own, 'SKILL.md'), 'utf8')).toBe('mine')
    expect(readFileSync(join(roots[1], 'orca-review-pr', 'SKILL.md'), 'utf8')).toBe('orca')
  })

  it('refuses a name outside the generated set', async () => {
    await writeWorkspaceActionSkills(
      [{ name: '../escape' as 'orca-create-pr', content: 'x' }],
      roots
    )
    expect(existsSync(join(home, '.claude', 'escape'))).toBe(false)
  })
})
