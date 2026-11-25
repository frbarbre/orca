import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseZshHistory, readZshHistory } from './zsh-history'

describe('parseZshHistory', () => {
  it('reads plain and extended entries, oldest first', () => {
    const text = 'ls\n: 1700000000:0;git status\n: 1700000001:3;pnpm test\n'
    expect(parseZshHistory(Buffer.from(text))).toEqual(['ls', 'git status', 'pnpm test'])
  })

  it('joins multi-line commands', () => {
    const text = ': 1700000000:0;for f in a b\\\ndo echo $f\\\ndone\n'
    expect(parseZshHistory(Buffer.from(text))).toEqual(['for f in a b\ndo echo $f\ndone'])
  })

  it('keeps only the latest copy of a repeated command', () => {
    const text = 'git status\nls\ngit status\n'
    expect(parseZshHistory(Buffer.from(text))).toEqual(['ls', 'git status'])
  })

  it('decodes zsh-metafied characters', () => {
    const encoded = Buffer.from('echo hæ', 'utf8')
    const metafied: number[] = []
    for (const byte of encoded) {
      if (byte >= 0x83) {
        metafied.push(0x83, byte ^ 32)
      } else {
        metafied.push(byte)
      }
    }
    expect(parseZshHistory(Buffer.from([...metafied, 0x0a]))).toEqual(['echo hæ'])
  })

  it('skips blank lines', () => {
    expect(parseZshHistory(Buffer.from('\n\nls\n\n'))).toEqual(['ls'])
  })
})

describe('readZshHistory', () => {
  let dir = ''
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'orca-zsh-history-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('reads a history file, also through a link', async () => {
    const file = join(dir, 'zsh_history')
    writeFileSync(file, ': 1:0;make\n')
    expect(await readZshHistory(file)).toEqual(['make'])
    const link = join(dir, '.histfile')
    symlinkSync(file, link)
    expect(await readZshHistory(link)).toEqual(['make'])
  })

  it('refuses files that are not history files', async () => {
    const secret = join(dir, 'id_rsa')
    writeFileSync(secret, 'key\n')
    expect(await readZshHistory(secret)).toEqual([])
    const link = join(dir, '.zsh_history')
    symlinkSync(secret, link)
    expect(await readZshHistory(link)).toEqual([])
    expect(await readZshHistory('relative/.zsh_history')).toEqual([])
    expect(await readZshHistory(join(dir, 'missing_history'))).toEqual([])
  })
})
