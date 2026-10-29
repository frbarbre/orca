// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenFile } from '@/store/slices/editor'
import { ORCA_EDITOR_REQUEST_CMD_SAVE_EVENT } from './editor-autosave'
import { useEditorCmdSaveRequest } from './useEditorCmdSaveRequest'

const storeState = vi.hoisted(() => ({ editorDrafts: {} as Record<string, string> }))
const EMPTY_FILE_CONTENTS: Parameters<typeof useEditorCmdSaveRequest>[0]['fileContents'] = {}

vi.mock('@/store', () => ({ useAppStore: { getState: () => storeState } }))
const formatFileBeforeSave = vi.hoisted(() => vi.fn(async (_filePath: string) => {}))
vi.mock('@/lib/format-before-save', () => ({ formatFileBeforeSave }))

const requestSave = async (fileId: string): Promise<void> => {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(ORCA_EDITOR_REQUEST_CMD_SAVE_EVENT, { detail: { fileId } })
    )
  })
}

type ProbeProps = {
  activeFile: OpenFile
  enabled: boolean
  fileContents?: Parameters<typeof useEditorCmdSaveRequest>[0]['fileContents']
  onSave: (content: string) => Promise<boolean>
  openFiles?: OpenFile[]
}

function SaveProbe({
  activeFile,
  enabled,
  fileContents = EMPTY_FILE_CONTENTS,
  onSave,
  openFiles
}: ProbeProps): null {
  useEditorCmdSaveRequest({
    activeFile,
    openFiles: openFiles ?? [activeFile],
    fileContents,
    handleSave: onSave,
    enabled
  })
  return null
}

function makeFile(id: string): OpenFile {
  return {
    id,
    filePath: `/repo/${id}.md`,
    relativePath: `${id}.md`,
    worktreeId: `worktree-${id}`,
    language: 'markdown',
    isDirty: true,
    mode: 'edit'
  }
}

describe('useEditorCmdSaveRequest', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    storeState.editorDrafts = {}
    formatFileBeforeSave.mockReset()
    container = document.body.appendChild(document.createElement('div'))
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('formats the file first, so Mod+S on a clean file saves the formatted text', async () => {
    const file = { ...makeFile('clean'), isDirty: false }
    const save = vi.fn(async () => true)
    formatFileBeforeSave.mockImplementation(async () => {
      storeState.editorDrafts = { [file.id]: 'formatted' }
    })
    act(() => {
      root.render(<SaveProbe activeFile={file} enabled onSave={save} />)
    })

    await requestSave(file.id)

    expect(formatFileBeforeSave).toHaveBeenCalledWith('/repo/clean.md')
    expect(save).toHaveBeenCalledExactlyOnceWith('formatted')
  })

  it('saves nothing for a clean file the formatter leaves as is', async () => {
    const file = { ...makeFile('clean'), isDirty: false }
    const save = vi.fn(async () => true)
    act(() => {
      root.render(<SaveProbe activeFile={file} enabled onSave={save} />)
    })

    await requestSave(file.id)

    expect(save).not.toHaveBeenCalled()
  })

  it('saves only the visible panel that owns the requested file', async () => {
    const visibleFile = makeFile('visible')
    const otherVisibleFile = makeFile('other-visible')
    const hiddenFile = makeFile('hidden')
    const visibleSave = vi.fn(async () => true)
    const mirroredSave = vi.fn(async () => true)
    const otherVisibleSave = vi.fn(async () => true)
    const hiddenSave = vi.fn(async () => true)
    storeState.editorDrafts = {
      [visibleFile.id]: 'visible draft',
      [otherVisibleFile.id]: 'other draft',
      [hiddenFile.id]: 'hidden draft'
    }

    act(() => {
      root.render(
        <>
          <SaveProbe activeFile={visibleFile} enabled onSave={visibleSave} />
          <SaveProbe activeFile={visibleFile} enabled={false} onSave={mirroredSave} />
          <SaveProbe activeFile={otherVisibleFile} enabled onSave={otherVisibleSave} />
          <SaveProbe activeFile={hiddenFile} enabled={false} onSave={hiddenSave} />
        </>
      )
    })
    await requestSave(visibleFile.id)

    expect(visibleSave).toHaveBeenCalledExactlyOnceWith('visible draft')
    expect(mirroredSave).not.toHaveBeenCalled()
    expect(otherVisibleSave).not.toHaveBeenCalled()
    expect(hiddenSave).not.toHaveBeenCalled()
  })

  it('uses the preview tab for ownership and the source file for content', async () => {
    const sourceFile = makeFile('source')
    const previewFile: OpenFile = {
      ...sourceFile,
      id: 'markdown-preview::source',
      markdownPreviewSourceFileId: sourceFile.id,
      mode: 'markdown-preview'
    }
    const save = vi.fn(async () => true)
    storeState.editorDrafts = { [sourceFile.id]: 'source draft' }

    act(() => {
      root.render(
        <SaveProbe
          activeFile={previewFile}
          enabled
          onSave={save}
          openFiles={[sourceFile, previewFile]}
        />
      )
    })
    await requestSave(sourceFile.id)
    await requestSave(previewFile.id)

    expect(save).toHaveBeenCalledExactlyOnceWith('source draft')
  })
})
