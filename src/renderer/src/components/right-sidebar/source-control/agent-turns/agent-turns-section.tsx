import React, { useCallback, useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { SectionHeader } from '../listing/section-header'
import { translate } from '@/i18n/i18n'
import type { AgentTurn } from '../../../../../../shared/agent-turns'
import { agentTurnDetail, agentTurnTitle } from './agent-turn-label'
import { openAgentTurn } from '@/lib/agent-turn-open'

function useAgentTurns(worktreePath: string): AgentTurn[] {
  const [loaded, setLoaded] = useState<{ worktreePath: string; turns: AgentTurn[] }>({
    worktreePath: '',
    turns: []
  })
  useEffect(() => {
    // Why: the web client's preload has no agentTurns bridge; turns are a desktop-only feature.
    const api = window.api?.agentTurns
    if (!api) {
      return
    }
    let cancelled = false
    const load = (): void => {
      void api.list({ worktreePath }).then((turns) => {
        if (!cancelled) {
          setLoaded({ worktreePath, turns })
        }
      })
    }
    load()
    const unsubscribe = api.onChanged((change) => {
      if (change.worktreePath === worktreePath) {
        load()
      }
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [worktreePath])
  return loaded.worktreePath === worktreePath ? loaded.turns : []
}

// Fork: each agent turn's own diff, snapshotted by the main process when the turn starts and ends.
export function AgentTurnsSection({
  worktreeId,
  worktreePath,
  collapsed,
  onToggle
}: {
  worktreeId: string
  worktreePath: string
  collapsed: boolean
  onToggle: () => void
}): React.JSX.Element | null {
  const turns = useAgentTurns(worktreePath)
  const openCommitAllDiffs = useAppStore((s) => s.openCommitAllDiffs)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const openTurn = useCallback(
    async (turn: AgentTurn) => {
      try {
        await openAgentTurn(worktreeId, worktreePath, turn, {
          commitCompare: window.api.git.commitCompare,
          openCommitAllDiffs
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error))
      }
    },
    [openCommitAllDiffs, worktreeId, worktreePath]
  )

  if (turns.length === 0) {
    return null
  }
  return (
    <div>
      <SectionHeader
        label={translate('agentTurns.title', 'Agent turns')}
        count={turns.length}
        isCollapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed &&
        turns.map((turn) => (
          <button
            key={turn.ref}
            type="button"
            title={turn.prompt}
            className="flex w-full min-w-0 items-start gap-2 px-3 py-1 text-left hover:bg-accent/60"
            onClick={() => void openTurn(turn)}
          >
            <Bot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-xs text-foreground">{agentTurnTitle(turn)}</span>
              <span className="truncate text-[10px] text-muted-foreground">
                {agentTurnDetail(turn, now)}
              </span>
            </span>
          </button>
        ))}
    </div>
  )
}
