import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createShellEditorSession,
  SHELL_EDITOR_NOT_ZSH_GRACE_MS,
  SHELL_EDITOR_STARTUP_TIMEOUT_MS
} from './shell-editor-session'

const INFO = { branch: 'main', histfile: '/h/.zsh_history', node: 'v24.14.0', cwd: '/repo' }

describe('shell editor session', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays off for a pane that never asked for the editor', () => {
    const session = createShellEditorSession()
    session.promptStart()
    vi.advanceTimersByTime(SHELL_EDITOR_NOT_ZSH_GRACE_MS)
    expect(session.getSnapshot().phase).toBe('off')
  })

  it('takes typing from spawn, then follows zsh between prompts and commands', () => {
    const session = createShellEditorSession()
    session.markRequested()
    expect(session.getSnapshot().phase).toBe('starting')

    session.promptStart()
    session.promptInfo(INFO)
    expect(session.getSnapshot()).toMatchObject({ phase: 'prompt', ...INFO })

    session.commandStart()
    expect(session.getSnapshot()).toMatchObject({ phase: 'running', cwd: '/repo' })

    session.promptStart()
    session.promptInfo({ ...INFO, cwd: '/repo/src' })
    expect(session.getSnapshot()).toMatchObject({ phase: 'prompt', cwd: '/repo/src' })
  })

  it('turns on for an editor prompt even when the request was not seen', () => {
    const session = createShellEditorSession()
    session.promptInfo(INFO)
    expect(session.getSnapshot().phase).toBe('prompt')
  })

  it('gives up when the shell prompts without the editor’s report', () => {
    const session = createShellEditorSession()
    session.markRequested()
    session.promptStart()
    vi.advanceTimersByTime(SHELL_EDITOR_NOT_ZSH_GRACE_MS)
    expect(session.getSnapshot().phase).toBe('off')
  })

  it('gives up when the shell never prompts', () => {
    const session = createShellEditorSession()
    session.markRequested()
    vi.advanceTimersByTime(SHELL_EDITOR_STARTUP_TIMEOUT_MS)
    expect(session.getSnapshot().phase).toBe('off')
  })

  it('queues a command until the first prompt, then hands it over once', () => {
    const session = createShellEditorSession()
    session.markRequested()
    session.queue('pnpm dev')
    expect(session.getSnapshot().queued).toBe('pnpm dev')
    expect(session.takeQueued()).toBeNull()

    session.promptInfo(INFO)
    expect(session.takeQueued()).toBe('pnpm dev')
    expect(session.takeQueued()).toBeNull()
    expect(session.getSnapshot().queued).toBeNull()
  })

  it('hides for a hand-off to zsh until the next prompt', () => {
    const session = createShellEditorSession()
    session.promptInfo(INFO)
    session.handOff()
    expect(session.getSnapshot().phase).toBe('handoff')
    session.promptInfo(INFO)
    expect(session.getSnapshot().phase).toBe('prompt')
  })

  it('counts prompts, so the same folder still reads as a new prompt', () => {
    const session = createShellEditorSession()
    session.promptInfo(INFO)
    session.commandStart()
    session.promptInfo(INFO)
    expect(session.getSnapshot().promptCount).toBe(2)
  })

  it('notifies subscribers only when something changed', () => {
    const session = createShellEditorSession()
    const listener = vi.fn()
    session.subscribe(listener)
    session.promptInfo(INFO)
    session.commandStart()
    session.commandStart()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('does not send a pane zsh already reported back to starting', () => {
    const session = createShellEditorSession()
    session.promptInfo(INFO)
    session.markRequested()
    expect(session.getSnapshot().phase).toBe('prompt')
    session.commandStart()
    session.markRequested()
    expect(session.getSnapshot().phase).toBe('running')
  })

  it('nudges once until zsh reports a prompt again', () => {
    const session = createShellEditorSession()
    expect(session.wasNudged()).toBe(false)
    session.markNudged()
    expect(session.wasNudged()).toBe(true)
    session.promptInfo(INFO)
    expect(session.wasNudged()).toBe(false)
  })

  it('stops its timers when disposed', () => {
    const session = createShellEditorSession()
    session.markRequested()
    session.dispose()
    vi.advanceTimersByTime(SHELL_EDITOR_STARTUP_TIMEOUT_MS)
    expect(session.getSnapshot().phase).toBe('starting')
  })
})
