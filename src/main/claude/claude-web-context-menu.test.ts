import { describe, expect, it, vi } from 'vitest'
import { buildClaudeWebContextMenu, type ClaudeWebMenuActions } from './claude-web-context-menu'

function params(overrides: Partial<Electron.ContextMenuParams>): Electron.ContextMenuParams {
  const base = {
    linkURL: '',
    selectionText: '',
    isEditable: false,
    editFlags: {
      canCut: false,
      canCopy: false,
      canPaste: false,
      canSelectAll: true,
      canUndo: false,
      canRedo: false,
      canDelete: false,
      canEditRichly: false
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only the fields set here.
  return { ...base, ...overrides } as Electron.ContextMenuParams
}

function actions(): ClaudeWebMenuActions {
  return {
    cut: vi.fn(),
    copy: vi.fn(),
    paste: vi.fn(),
    selectAll: vi.fn(),
    openLink: vi.fn(),
    copyText: vi.fn()
  }
}

describe('buildClaudeWebContextMenu', () => {
  it('offers the edit commands in the prompt, enabled by what the page allows', () => {
    const items = buildClaudeWebContextMenu(
      params({
        isEditable: true,
        selectionText: 'hi',
        editFlags: { ...params({}).editFlags, canCut: true, canCopy: true, canPaste: true }
      }),
      actions()
    )
    expect(items.map((item) => [item.label, item.enabled])).toEqual([
      ['Cut', true],
      ['Copy', true],
      ['Paste', true],
      ['Select All', true]
    ])
  })

  it('offers Copy for selected text on the page', () => {
    const run = actions()
    const items = buildClaudeWebContextMenu(
      params({ selectionText: 'some text', editFlags: { ...params({}).editFlags, canCopy: true } }),
      run
    )
    expect(items.map((item) => item.label)).toEqual(['Copy', 'Select All'])
    items[0]?.click()
    expect(run.copy).toHaveBeenCalled()
  })

  it('offers to open or copy a link', () => {
    const run = actions()
    const items = buildClaudeWebContextMenu(params({ linkURL: 'https://example.com/a' }), run)
    expect(items.slice(0, 2).map((item) => item.label)).toEqual(['Open Link', 'Copy Link'])
    items[0]?.click()
    items[1]?.click()
    expect(run.openLink).toHaveBeenCalledWith('https://example.com/a')
    expect(run.copyText).toHaveBeenCalledWith('https://example.com/a')
  })

  it('never offers to open a link that is not http(s)', () => {
    const items = buildClaudeWebContextMenu(params({ linkURL: 'file:///etc/passwd' }), actions())
    expect(items.map((item) => item.label)).toEqual(['Select All'])
  })
})
