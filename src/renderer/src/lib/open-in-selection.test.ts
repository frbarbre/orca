import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearOpenInSelection,
  getOpenInSelection,
  resolveOpenInPath,
  setOpenInSelection
} from './open-in-selection'

describe('open-in selection registry', () => {
  beforeEach(() => {
    clearOpenInSelection('explorer')
    clearOpenInSelection('source-control')
  })

  it('keeps the two panels separate', () => {
    setOpenInSelection('explorer', '/w/a.ts')
    setOpenInSelection('source-control', '/w/b.ts')
    expect(getOpenInSelection('explorer')).toBe('/w/a.ts')
    expect(getOpenInSelection('source-control')).toBe('/w/b.ts')
  })

  it('treats a null path as no selection', () => {
    setOpenInSelection('explorer', '/w/a.ts')
    setOpenInSelection('explorer', null)
    expect(getOpenInSelection('explorer')).toBeNull()
  })
})

describe('resolveOpenInPath', () => {
  const base = { worktreePath: '/w', explorerPath: '/w/a.ts', sourceControlPath: '/w/b.ts' }

  it('opens the explorer selection on the explorer tab', () => {
    expect(resolveOpenInPath({ ...base, tab: 'explorer' })).toBe('/w/a.ts')
  })

  it('opens the source-control selection on the source-control tab', () => {
    expect(resolveOpenInPath({ ...base, tab: 'source-control' })).toBe('/w/b.ts')
  })

  it('ignores the other panel selection', () => {
    expect(resolveOpenInPath({ ...base, tab: 'explorer', explorerPath: null })).toBe('/w')
    expect(resolveOpenInPath({ ...base, tab: 'source-control', sourceControlPath: null })).toBe(
      '/w'
    )
  })

  it('falls back to the worktree on any other tab', () => {
    expect(resolveOpenInPath({ ...base, tab: 'checks' })).toBe('/w')
  })

  it('falls back to the worktree when nothing is selected anywhere', () => {
    expect(
      resolveOpenInPath({
        tab: 'explorer',
        worktreePath: '/w',
        explorerPath: null,
        sourceControlPath: null
      })
    ).toBe('/w')
  })
})
