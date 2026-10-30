import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const cask = readFileSync(join(import.meta.dirname, '..', '..', 'Casks', 'orca.rb'), 'utf8')

describe('fork Homebrew cask', () => {
  it("installs the fork's latest release DMG", () => {
    expect(cask).toContain(
      'url "https://github.com/frbarbre/orca/releases/latest/download/orca-macos-#{arch}.dmg"'
    )
    expect(cask).not.toContain('stablyai/orca')
  })

  it('needs no bump per release because the in-app updater owns updates', () => {
    expect(cask).toContain('version :latest')
    expect(cask).toContain('sha256 :no_check')
    expect(cask).toContain('auto_updates true')
  })
})
