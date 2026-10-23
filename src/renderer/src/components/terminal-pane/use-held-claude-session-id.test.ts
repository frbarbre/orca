// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHeldClaudeSessionId } from './use-held-claude-session-id'

describe('useHeldClaudeSessionId', () => {
  it("keeps the pane's Claude session through a moment its status row reads empty", () => {
    const { result, rerender } = renderHook(
      ({ leafId, sessionId }) => useHeldClaudeSessionId(leafId, sessionId),
      { initialProps: { leafId: 'leaf-a' as string | null, sessionId: 's1' as string | null } }
    )
    expect(result.current).toBe('s1')

    rerender({ leafId: 'leaf-a', sessionId: null })
    expect(result.current).toBe('s1')

    rerender({ leafId: 'leaf-a', sessionId: 's2' })
    expect(result.current).toBe('s2')
  })

  it('lets go once the view moves to another pane or closes', () => {
    const { result, rerender } = renderHook(
      ({ leafId, sessionId }) => useHeldClaudeSessionId(leafId, sessionId),
      { initialProps: { leafId: 'leaf-a' as string | null, sessionId: 's1' as string | null } }
    )

    rerender({ leafId: 'leaf-b', sessionId: null })
    expect(result.current).toBeNull()

    rerender({ leafId: null, sessionId: null })
    expect(result.current).toBeNull()
  })
})
