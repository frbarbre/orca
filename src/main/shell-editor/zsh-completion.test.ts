import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createZshCompletionWorker,
  parseZshCompletions,
  sanitizeCompletionInput,
  type ZshCompletionWorker
} from './zsh-completion'

describe('parseZshCompletions', () => {
  it('reads each candidate, its description and zsh’s tag for it once, in zsh’s order', () => {
    expect(
      parseZshCompletions(
        'checkout\u001fswitch branches\u001fmain-porcelain-commands\ncherry\u001f\u001f\n' +
          'checkout\u001fswitch branches\u001fmain-porcelain-commands\nold\u001fno tag\n\n'
      )
    ).toEqual([
      { value: 'checkout', description: 'switch branches', tag: 'main-porcelain-commands' },
      { value: 'cherry', description: null, tag: null },
      { value: 'old', description: 'no tag', tag: null }
    ])
  })
})

describe('sanitizeCompletionInput', () => {
  it('drops control characters so a line can never be submitted to the hidden shell', () => {
    expect(sanitizeCompletionInput('ls a\r\nrm -rf x\u0003\u001b[A')).toBe('ls arm -rf x[A')
  })
})

// Why: CI's Linux runners have no zsh; the worker falls back to /bin/zsh.
const hasZsh = process.platform !== 'win32' && existsSync('/bin/zsh')

describe.skipIf(!hasZsh)('createZshCompletionWorker', () => {
  let dir = ''
  let worker: ZshCompletionWorker

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'orca-zsh-completion-'))
    mkdirSync(join(dir, 'menu-alpha'))
    mkdirSync(join(dir, 'menu-beta'))
    writeFileSync(join(dir, 'menu-file.txt'), '')
    mkdirSync(join(dir, 'nested', 'inner'), { recursive: true })
    worker = createZshCompletionWorker({
      scriptDir: join(dir, '.scripts'),
      zshArgs: ['-f', '-i']
    })
  })

  afterAll(() => {
    worker.dispose()
    rmSync(dir, { recursive: true, force: true })
  })

  // Why the long timeout: the first request starts the hidden zsh and runs compinit.
  it('lists files and folders for the word being typed, with a slash after folders', async () => {
    await expect(worker.complete({ cwd: dir, line: 'ls menu-' })).resolves.toMatchObject([
      { value: 'menu-alpha/', description: null },
      { value: 'menu-beta/', description: null },
      { value: 'menu-file.txt', description: null, tag: expect.stringMatching(/files/) }
    ])
  }, 20_000)

  it('keeps answering, from whichever folder is asked', async () => {
    await expect(worker.complete({ cwd: dir, line: 'ls nested/in' })).resolves.toMatchObject([
      { value: 'nested/inner/', description: null }
    ])
    await expect(
      worker.complete({ cwd: join(dir, 'nested'), line: 'cd in' })
    ).resolves.toMatchObject([
      { value: 'inner/', description: null, tag: expect.stringMatching(/directories/) }
    ])
  })

  it('describes subcommands the way zsh does', async () => {
    const items = await worker.complete({ cwd: dir, line: 'git checko' })
    expect(items[0]).toEqual({
      value: 'checkout',
      description: expect.stringMatching(/\S/),
      tag: expect.stringMatching(/commands$/)
    })
  })

  it('escapes a name the way zsh would insert it', async () => {
    writeFileSync(join(dir, 'spaced name.txt'), '')
    await expect(worker.complete({ cwd: dir, line: 'cat spa' })).resolves.toMatchObject([
      { value: 'spaced\\ name.txt', description: null }
    ])
  })

  it('finds nothing for a word nothing matches', async () => {
    await expect(worker.complete({ cwd: dir, line: 'ls zz-none-' })).resolves.toEqual([])
  })
})
