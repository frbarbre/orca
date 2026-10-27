import { describe, expect, it } from 'vitest'
import { getWorktreeCardDisplayOptions } from './sidebar-workspace-option-items'

describe('fork card display options', () => {
  it('offers the stack position after the PR author', () => {
    const options = getWorktreeCardDisplayOptions(false).map(({ id, label }) => ({ id, label }))
    const authorIndex = options.findIndex((option) => option.id === 'pr-author')
    expect(options[authorIndex + 1]).toEqual({ id: 'stack', label: 'Stack' })
  })
})
