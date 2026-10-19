import { describe, expect, it } from 'vitest'
import { withTabQuickCommandLabel } from './tab-quick-command-label'

const state = {
  unifiedTabsByWorktree: {
    'wt-1': [
      { id: 'unified-1', entityId: 'term-1', contentType: 'terminal', label: 'zsh' },
      { id: 'unified-2', entityId: 'term-2', contentType: 'terminal', label: 'zsh' }
    ]
  },
  tabsByWorktree: {
    'wt-1': [
      { id: 'term-1', title: 'zsh' },
      { id: 'term-2', title: 'zsh' }
    ]
  }
} as never

describe('withTabQuickCommandLabel', () => {
  it('names the tab and its terminal after the quick command, and nothing else', () => {
    const patch = withTabQuickCommandLabel(state, 'unified-2', 'Dev')

    expect(patch.unifiedTabsByWorktree?.['wt-1']).toEqual([
      { id: 'unified-1', entityId: 'term-1', contentType: 'terminal', label: 'zsh' },
      {
        id: 'unified-2',
        entityId: 'term-2',
        contentType: 'terminal',
        label: 'zsh',
        quickCommandLabel: 'Dev'
      }
    ])
    expect(patch.tabsByWorktree?.['wt-1']).toEqual([
      { id: 'term-1', title: 'zsh' },
      { id: 'term-2', title: 'zsh', quickCommandLabel: 'Dev' }
    ])
  })

  it('changes nothing for a tab that is gone or a blank label', () => {
    expect(withTabQuickCommandLabel(state, 'missing', 'Dev')).toEqual({})
    expect(withTabQuickCommandLabel(state, 'unified-1', '  ')).toEqual({})
  })
})
