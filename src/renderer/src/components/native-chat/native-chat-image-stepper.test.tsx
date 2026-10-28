// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { resetLocalImageSrcStateForTests } from '@/components/editor/useLocalImageSrc'
import { useAppStore } from '@/store'
import { NativeChatMarkdown } from './NativeChatMarkdown'
import { NativeChatMarkdownImageOwnerContext } from './native-chat-markdown-image-owner'
import { NativeChatImageStepperProvider } from './native-chat-image-stepper'
import { repoFixture, worktreeFixture } from './native-chat-workspace-test-fixtures'

const readRuntimeFilePreview = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-file-read-client', () => ({ readRuntimeFilePreview }))

const owner = {
  fileLinkContext: {
    worktreeId: 'wt-1',
    worktreePath: '/repo/worktree',
    runtimeEnvironmentId: null,
    sourceTabId: 'tab-1'
  },
  runtimeContext: {
    target: { kind: 'local' as const },
    worktreeId: 'wt-1',
    worktreePath: '/repo/worktree',
    expectedExecutionHostId: 'local' as const
  },
  isVisible: true
}

beforeEach(() => {
  resetLocalImageSrcStateForTests()
  vi.stubGlobal('IntersectionObserver', undefined)
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    repos: [repoFixture()],
    worktreesByRepo: { repo: [worktreeFixture('wt-1', '/repo/worktree', { hostId: 'local' })] },
    activeWorktreeId: 'wt-1',
    activeWorkspaceExecutionHostId: 'local'
  })
  let sequence = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:image-${++sequence}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  readRuntimeFilePreview.mockResolvedValue({
    content: 'AA==',
    isBinary: true,
    mimeType: 'image/png'
  })
})

afterEach(() => {
  cleanup()
  resetLocalImageSrcStateForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('steps to the next and previous image of the chat with the arrow keys', async () => {
  render(
    <TooltipProvider>
      <NativeChatMarkdownImageOwnerContext.Provider value={owner}>
        <NativeChatImageStepperProvider>
          <NativeChatMarkdown
            content={'![First](first.png)\n\nSome prose\n\n![Second](second.png)'}
            variant="document"
            allowFileUriLinks
          />
        </NativeChatImageStepperProvider>
      </NativeChatMarkdownImageOwnerContext.Provider>
    </TooltipProvider>
  )
  fireEvent.click(screen.getByRole('button', { name: 'View image: First' }))
  expect(screen.getByRole('dialog', { name: 'First' })).toBeInTheDocument()

  fireEvent.keyDown(screen.getByRole('dialog', { name: 'First' }), { key: 'ArrowRight' })
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'Second' })).toBeInTheDocument())
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'First' })).toBeNull())

  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Second' }), { key: 'ArrowLeft' })
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'First' })).toBeInTheDocument())
})
