// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Composer } from './Composer'
import { ComposerSurfaceContext, type ComposerSurface } from './composer-surface'

const editorProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/components/github/ReviewMarkdownComposer', () => ({
  ReviewMarkdownComposer: (props: Record<string, unknown>) => {
    editorProps.current = props
    return null
  }
}))
vi.mock('@/store', () => ({
  useAppStore: (select: (state: { activeWorktreeId: string }) => unknown) =>
    select({ activeWorktreeId: 'wt-active' })
}))

afterEach(cleanup)

const base = { value: '', onChange: vi.fn(), placeholder: 'Reply' }
const people = [{ login: 'madsenmm', source: 'Commenter' }]
const prSurface: ComposerSurface = { worktreeId: 'wt-pr' }
const unattachedSurface: ComposerSurface = { worktreeId: null, people }

describe('Composer', () => {
  it("names the active workspace's files unless told which workspace, or none", () => {
    render(<Composer context="github" {...base} />)
    expect(editorProps.current.fileMentionWorktreeId).toBe('wt-active')

    render(<Composer context="github" worktreeId="wt-pr" {...base} />)
    expect(editorProps.current.fileMentionWorktreeId).toBe('wt-pr')

    render(<Composer context="github" worktreeId={null} {...base} />)
    expect(editorProps.current.fileMentionWorktreeId).toBeNull()
  })

  it("names the files of the workspace its surface belongs to, such as a pull request's", () => {
    render(
      <ComposerSurfaceContext.Provider value={prSurface}>
        <Composer context="github" {...base} />
      </ComposerSurfaceContext.Provider>
    )
    expect(editorProps.current.fileMentionWorktreeId).toBe('wt-pr')

    render(
      <ComposerSurfaceContext.Provider value={unattachedSurface}>
        <Composer context="github" {...base} />
      </ComposerSurfaceContext.Provider>
    )
    expect(editorProps.current.fileMentionWorktreeId).toBeNull()
  })

  it("suggests the people it is given, such as a pull request's participants", () => {
    render(<Composer context="github" people={people} {...base} />)
    expect(editorProps.current.people).toBe(people)
  })

  it("suggests its surface's people when given none itself", () => {
    render(
      <ComposerSurfaceContext.Provider value={unattachedSurface}>
        <Composer context="github" {...base} />
      </ComposerSurfaceContext.Provider>
    )
    expect(editorProps.current.people).toBe(people)
  })
})
