import { describe, expect, it } from 'vitest'
import { getWorktreeCardDisplayOptions } from './sidebar-workspace-option-items'

describe('fork card display options', () => {
  it('offers the stack position after the PR author', () => {
    const options = getWorktreeCardDisplayOptions(false).map(({ id, label }) => ({ id, label }))
    const authorIndex = options.findIndex((option) => option.id === 'pr-author')
    expect(options[authorIndex + 1]).toEqual({ id: 'stack', label: 'Stack' })
  })

  it('offers the PR diff after the stack position', () => {
    const options = getWorktreeCardDisplayOptions(false).map(({ id, label }) => ({ id, label }))
    const stackIndex = options.findIndex((option) => option.id === 'stack')
    expect(options[stackIndex + 1]).toEqual({ id: 'pr-diff', label: 'PR diff' })
  })

  it('offers the project chip after the host', () => {
    const options = getWorktreeCardDisplayOptions(false).map(({ id, label }) => ({ id, label }))
    const hostIndex = options.findIndex((option) => option.id === 'host')
    expect(options[hostIndex + 1]).toEqual({ id: 'project', label: 'Project' })
  })
})
