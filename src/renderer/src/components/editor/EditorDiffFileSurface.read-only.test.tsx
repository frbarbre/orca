// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OpenFile } from '@/store/slices/editor'
import type { GitDiffResult } from '../../../../shared/git-diff-compare-types'

const viewer = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))

vi.mock('./editor-lazy-views', () => ({
  DiffViewer: (props: Record<string, unknown>) => {
    viewer.props = props
    return null
  },
  ImageDiffViewer: () => null,
  MarkdownPreview: () => null
}))

import { EditorDiffFileSurface } from './EditorDiffFileSurface'
import type { useMarkdownDocuments } from './useMarkdownDocuments'

const diffContent: GitDiffResult = {
  kind: 'text',
  originalContent: 'a\n',
  modifiedContent: 'b\n',
  originalIsBinary: false,
  modifiedIsBinary: false
}

function renderDiff(diffSource: OpenFile['diffSource']): void {
  const activeFile: OpenFile = {
    id: `wt::diff::${diffSource}::src/a.ts`,
    filePath: '/repo/src/a.ts',
    relativePath: 'src/a.ts',
    worktreeId: 'wt',
    language: 'typescript',
    mode: 'diff',
    diffSource,
    isDirty: false
  }
  render(
    <EditorDiffFileSurface
      activeFile={activeFile}
      diffContent={diffContent}
      editBuffer={undefined}
      resolvedLanguage="typescript"
      sideBySide={false}
      viewStateScopeId={activeFile.id}
      diffViewStateKey={activeFile.id}
      mdViewMode="source"
      isMarkdown={false}
      showMarkdownTableOfContents={false}
      onCloseMarkdownTableOfContents={vi.fn()}
      markdownAnnotationsEnabled={false}
      markdownDocuments={{} as ReturnType<typeof useMarkdownDocuments>}
      reloadContent={vi.fn()}
    />
  )
}

afterEach(() => {
  cleanup()
  viewer.props = null
})

describe('EditorDiffFileSurface', () => {
  it.each(['unstaged', 'branch-worktree'] as const)(
    'shows a %s diff read-only, since the edit view is where a file changes',
    (diffSource) => {
      renderDiff(diffSource)

      expect(viewer.props).toMatchObject({ editable: false })
      expect(viewer.props?.onContentChange).toBeUndefined()
      expect(viewer.props?.onSave).toBeUndefined()
    }
  )
})
