import { describe, expect, it } from 'vitest'
import { formatterForFile, formatterSettings, isFormatterId } from './formatter'

describe('formatter registry', () => {
  it('picks oxfmt for the web files it formats and ruff for Python', () => {
    expect(
      ['a.ts', 'b.tsx', 'c.mjs', 'd.json', 'e.css', 'f.md', 'g.yaml'].map(formatterForFile)
    ).toEqual(['oxfmt', 'oxfmt', 'oxfmt', 'oxfmt', 'oxfmt', 'oxfmt', 'oxfmt'])
    expect(['/repo/a.py', '/repo/b.pyi'].map(formatterForFile)).toEqual(['ruff', 'ruff'])
  })

  it('formats nothing it has no formatter for', () => {
    expect(['/repo/a.go', '/repo/Makefile', '/repo/.env'].map(formatterForFile)).toEqual([
      null,
      null,
      null
    ])
  })

  it('reads a missing formatter as on and a blank path as none', () => {
    expect(formatterSettings(null, 'ruff')).toEqual({ enabled: true, command: null })
    expect(
      formatterSettings({ formatters: { oxfmt: { enabled: false, command: '  ' } } }, 'oxfmt')
    ).toEqual({ enabled: false, command: null })
    expect(
      formatterSettings({ formatters: { ruff: { command: ' ~/bin/ruff ' } } }, 'ruff')
    ).toEqual({ enabled: true, command: '~/bin/ruff' })
  })

  it('knows its own ids', () => {
    expect([isFormatterId('ruff'), isFormatterId('oxlint'), isFormatterId(1)]).toEqual([
      true,
      false,
      false
    ])
  })
})
