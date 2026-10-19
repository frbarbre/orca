// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiffCommentCard } from './DiffCommentCard'
import type { ComposerProps } from '@/components/composer/Composer'

const composer = vi.hoisted(() => ({}) as Partial<ComposerProps>)
vi.mock('@/components/composer/Composer', () => ({
  Composer: (props: ComposerProps) => {
    Object.assign(composer, props)
    return <textarea aria-label="note" value={props.value} readOnly />
  }
}))

describe('DiffCommentCard content resize', () => {
  let notifyObservedResize: ResizeObserverCallback
  let constructObserver = vi.fn<() => void>()
  let disconnect: ReturnType<typeof vi.fn>
  let frameCallbacks: Map<number, FrameRequestCallback>
  let nextFrameId: number

  beforeEach(() => {
    constructObserver = vi.fn<() => void>()
    disconnect = vi.fn()
    frameCallbacks = new Map()
    nextFrameId = 1

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        constructObserver()
        notifyObservedResize = callback
      }

      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = disconnect
    }

    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId++
        frameCallbacks.set(frameId, callback)
        return frameId
      })
    )
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((frameId: number) => frameCallbacks.delete(frameId))
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('re-measures after wrapping and coalesces observer notifications', () => {
    const onContentResize = vi.fn()
    const view = render(
      <DiffCommentCard
        lineNumber={26}
        body="A saved note"
        onContentResize={onContentResize}
        observeRenderedSize
      />
    )

    expect(constructObserver).toHaveBeenCalledOnce()
    expect(onContentResize).toHaveBeenCalledOnce()

    act(() => {
      notifyObservedResize([], {} as ResizeObserver)
      notifyObservedResize([], {} as ResizeObserver)
    })
    expect(requestAnimationFrame).toHaveBeenCalledOnce()

    const callback = frameCallbacks.values().next().value
    frameCallbacks.clear()
    act(() => callback?.(0))
    expect(onContentResize).toHaveBeenCalledTimes(2)

    const latestOnContentResize = vi.fn()
    view.rerender(
      <DiffCommentCard
        lineNumber={26}
        body="A saved note"
        onContentResize={latestOnContentResize}
        observeRenderedSize
      />
    )
    expect(disconnect).not.toHaveBeenCalled()

    act(() => notifyObservedResize([], {} as ResizeObserver))
    const latestCallback = frameCallbacks.values().next().value
    act(() => latestCallback?.(0))
    expect(latestOnContentResize).toHaveBeenCalledOnce()

    view.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('does not observe cards outside Monaco view zones', () => {
    const onContentResize = vi.fn()
    render(
      <DiffCommentCard lineNumber={26} body="A saved note" onContentResize={onContentResize} />
    )

    expect(constructObserver).not.toHaveBeenCalled()
    expect(onContentResize).not.toHaveBeenCalled()
  })

  it('requests rail reflow only when the editing box height changes', () => {
    const onContentResize = vi.fn()
    const view = render(
      <DiffCommentCard
        lineNumber={26}
        body="A saved note"
        onContentResize={onContentResize}
        onSubmitEdit={async () => true}
      />
    )

    fireEvent.click(view.getByRole('button', { name: 'Edit note' }))
    expect(onContentResize).toHaveBeenCalledOnce()
    expect(composer.context).toBe('agent')

    act(() => composer.onHeightChange?.(60))
    expect(onContentResize).toHaveBeenCalledTimes(2)
    for (let index = 0; index < 50; index++) {
      act(() => composer.onHeightChange?.(60))
    }
    expect(onContentResize).toHaveBeenCalledTimes(2)

    act(() => composer.onHeightChange?.(240))
    expect(onContentResize).toHaveBeenCalledTimes(3)
    act(() => composer.onHeightChange?.(80))
    expect(onContentResize).toHaveBeenCalledTimes(4)

    fireEvent.click(view.getByRole('button', { name: 'Cancel' }))
    expect(onContentResize).toHaveBeenCalledTimes(5)
  })
})
