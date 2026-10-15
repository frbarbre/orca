// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWorktreePortLabels } from './workspace-port-labels'

const runWorkspaceCommand = vi.fn(async () => ({
  success: true,
  output: 'Frontend  http://wt.localhost:21486\nSpotlight  http://wt.localhost:21495'
}))

vi.stubGlobal(
  'window',
  Object.assign(window, { api: { reviewStatusRules: { runWorkspaceCommand } } })
)

afterEach(() => runWorkspaceCommand.mockClear())

describe('useWorktreePortLabels', () => {
  it('runs the command in the workspace once per set of live ports', async () => {
    const { result, rerender } = renderHook(
      ({ ports }: { ports: number[] }) =>
        useWorktreePortLabels('wt-hook', '/work/wt', 'mise run print-urls', ports),
      { initialProps: { ports: [21486] } }
    )
    await waitFor(() =>
      expect(result.current.map((entry) => entry.label)).toEqual(['Frontend', 'Spotlight'])
    )
    expect(runWorkspaceCommand).toHaveBeenCalledWith({
      worktreePath: '/work/wt',
      command: 'mise run print-urls'
    })

    rerender({ ports: [21486] })
    expect(runWorkspaceCommand).toHaveBeenCalledTimes(1)

    rerender({ ports: [21486, 21495] })
    await waitFor(() => expect(runWorkspaceCommand).toHaveBeenCalledTimes(2))
  })

  it('runs nothing without a command', () => {
    const { result } = renderHook(() =>
      useWorktreePortLabels('wt-none', '/work/wt', undefined, [1])
    )
    expect(result.current).toEqual([])
    expect(runWorkspaceCommand).not.toHaveBeenCalled()
  })
})
