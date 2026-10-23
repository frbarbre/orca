// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GitBranchChangeEntry } from '../../../shared/git-diff-compare-types'
import { resolveQuickOpenTarget } from './quick-open-change'
import { ChangeEntryStat } from './right-sidebar/source-control/listing/change-entry-stat'

afterEach(cleanup)

const change: GitBranchChangeEntry = { path: 'src/a.ts', status: 'modified', added: 23, removed: 1 }
const changes = new Map([[change.path, change]])

describe('resolveQuickOpenTarget', () => {
  it('opens the diff of a file that has changes in the current scope', () => {
    expect(resolveQuickOpenTarget('src/a.ts', { pathQuery: 'a' }, changes)).toEqual({
      kind: 'diff',
      entry: change
    })
  })

  it('opens the file itself when it has no changes in scope, or a line was asked for', () => {
    expect(resolveQuickOpenTarget('src/b.ts', { pathQuery: 'b' }, changes)).toEqual({
      kind: 'file'
    })
    expect(resolveQuickOpenTarget('src/a.ts', { pathQuery: 'a', line: 12 }, changes)).toEqual({
      kind: 'file'
    })
  })
})

describe('ChangeEntryStat', () => {
  it("shows a change's line counts and status the way Source Control's row does", () => {
    render(<ChangeEntryStat entry={change} />)
    expect(screen.getByText('+23')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
  })
})
