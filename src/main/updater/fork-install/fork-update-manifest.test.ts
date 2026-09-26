import { describe, expect, it } from 'vitest'
import { parseForkUpdateManifest, selectForkUpdateAsset } from './fork-update-manifest'

// The manifest electron-builder published for v1.4.228, verbatim.
const MANIFEST = `version: 1.4.228
files:
  - url: Orca-1.4.228-mac.zip
    sha512: wkMqbUMJsRBBZInsKp9qLMZlkLjhqAvL1jNrnZAVfVgNvjV3u+h76HptIxYVkeFgzuc9ogu+64qDwtAls82eIw==
    size: 233906444
  - url: Orca-1.4.228-arm64-mac.zip
    sha512: 1pZu/MsdMEuqaZ3TNn5BqD9kTh9Ig8YbVlk5TUaSaJ7GXbO4Lm==
    size: 227500486
path: Orca-1.4.228-mac.zip
sha512: wkMqbUMJsRBBZInsKp9qLMZlkLjhqAvL1jNrnZAVfVgNvjV3u+h76HptIxYVkeFgzuc9ogu+64qDwtAls82eIw==
releaseDate: '2026-09-26T14:20:00.000Z'
`

describe('parseForkUpdateManifest', () => {
  it('reads every file entry', () => {
    expect(parseForkUpdateManifest(MANIFEST)).toStrictEqual([
      {
        fileName: 'Orca-1.4.228-mac.zip',
        sha512:
          'wkMqbUMJsRBBZInsKp9qLMZlkLjhqAvL1jNrnZAVfVgNvjV3u+h76HptIxYVkeFgzuc9ogu+64qDwtAls82eIw==',
        size: 233906444
      },
      {
        fileName: 'Orca-1.4.228-arm64-mac.zip',
        sha512: '1pZu/MsdMEuqaZ3TNn5BqD9kTh9Ig8YbVlk5TUaSaJ7GXbO4Lm==',
        size: 227500486
      }
    ])
  })

  // Why: the trailing top-level `path`/`sha512` name the x64 build again, and reading them as a
  // third entry would offer an Intel zip to an Apple Silicon machine.
  it('does not mistake the trailing summary for another file', () => {
    expect(parseForkUpdateManifest(MANIFEST)).toHaveLength(2)
  })

  it('survives a manifest it cannot make sense of', () => {
    expect(parseForkUpdateManifest('')).toStrictEqual([])
    expect(parseForkUpdateManifest('version: 9\nfiles:\n')).toStrictEqual([])
  })
})

describe('selectForkUpdateAsset', () => {
  const assets = parseForkUpdateManifest(MANIFEST)

  it('picks the arm64 zip on Apple Silicon', () => {
    expect(selectForkUpdateAsset(assets, 'arm64')?.fileName).toBe('Orca-1.4.228-arm64-mac.zip')
  })

  it('picks the Intel zip elsewhere', () => {
    expect(selectForkUpdateAsset(assets, 'x64')?.fileName).toBe('Orca-1.4.228-mac.zip')
  })

  it('answers null when the release has no zip for this machine', () => {
    expect(selectForkUpdateAsset([], 'arm64')).toBeNull()
  })
})
