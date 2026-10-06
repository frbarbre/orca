import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeRemoteSessionUrlResult } from '../../../../shared/claude-remote-session'
import { pollClaudeRemoteSessionUrl, REMOTE_CONTROL_WAIT_MS } from './claude-remote-session-poll'

afterEach(() => {
  vi.useRealTimers()
})

function results(first: ClaudeRemoteSessionUrlResult, ...rest: ClaudeRemoteSessionUrlResult[]) {
  const queue = [first, ...rest]
  return vi.fn(async () => (queue.length > 1 ? queue.shift()! : queue[0]))
}

describe('pollClaudeRemoteSessionUrl', () => {
  it('keeps polling a just-started session until Remote Control connects', async () => {
    vi.useFakeTimers()
    const resolve = results(
      { status: 'session-not-found' },
      { status: 'remote-control-off', startedAt: Date.now() },
      { status: 'ready', url: 'https://claude.ai/code/session_01A' }
    )
    const pending = pollClaudeRemoteSessionUrl(resolve, new AbortController().signal)
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toEqual({
      status: 'ready',
      url: 'https://claude.ai/code/session_01A'
    })
    expect(resolve).toHaveBeenCalledTimes(3)
  })

  it('reports Remote Control off at once for a session that has been running a while', async () => {
    const resolve = results({
      status: 'remote-control-off',
      startedAt: Date.now() - REMOTE_CONTROL_WAIT_MS - 1
    })
    await expect(
      pollClaudeRemoteSessionUrl(resolve, new AbortController().signal)
    ).resolves.toMatchObject({ status: 'remote-control-off' })
    expect(resolve).toHaveBeenCalledOnce()
  })

  it('gives up after the wait', async () => {
    vi.useFakeTimers()
    const resolve = results({ status: 'session-not-found' })
    const pending = pollClaudeRemoteSessionUrl(resolve, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(REMOTE_CONTROL_WAIT_MS + 2_000)
    await expect(pending).resolves.toEqual({ status: 'session-not-found' })
  })

  it('stops when aborted', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const resolve = results({ status: 'session-not-found' })
    const pending = pollClaudeRemoteSessionUrl(resolve, controller.signal)
    const rejection = expect(pending).rejects.toBeDefined()
    await vi.advanceTimersByTimeAsync(100)
    controller.abort()
    await rejection
    const callsAtAbort = resolve.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(resolve).toHaveBeenCalledTimes(callsAtAbort)
  })
})
