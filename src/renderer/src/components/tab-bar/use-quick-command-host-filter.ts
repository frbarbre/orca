import { useCallback, useMemo, useState } from 'react'
import type {
  HostedTerminalQuickCommand,
  TerminalQuickCommandHost
} from '@/hooks/use-terminal-quick-command-hosts'
import {
  hideQuickCommandsOfHiddenHosts,
  readHiddenQuickCommandHosts,
  toggleQuickCommandHost,
  writeHiddenQuickCommandHosts
} from './quick-command-host-visibility'

export function useQuickCommandHostFilter(
  hosts: readonly TerminalQuickCommandHost[],
  repoCommands: readonly HostedTerminalQuickCommand[],
  globalCommands: readonly HostedTerminalQuickCommand[]
): {
  showHostFilter: boolean
  hiddenHosts: readonly string[]
  repoCommands: readonly HostedTerminalQuickCommand[]
  globalCommands: readonly HostedTerminalQuickCommand[]
  toggleHost: (hostId: string) => void
  reloadHiddenHosts: () => void
} {
  const [hiddenHosts, setHiddenHosts] = useState(readHiddenQuickCommandHosts)
  const showHostFilter = hosts.length > 1
  const applied = useMemo(
    () => (showHostFilter ? hiddenHosts : []),
    [showHostFilter, hiddenHosts]
  )
  const visibleRepoCommands = useMemo(
    () => hideQuickCommandsOfHiddenHosts(repoCommands, applied),
    [repoCommands, applied]
  )
  const visibleGlobalCommands = useMemo(
    () => hideQuickCommandsOfHiddenHosts(globalCommands, applied),
    [globalCommands, applied]
  )
  const toggleHost = useCallback(
    (hostId: string): void => {
      const next = toggleQuickCommandHost(
        hiddenHosts,
        hostId,
        hosts.map((host) => host.hostId)
      )
      setHiddenHosts(next)
      writeHiddenQuickCommandHosts(next)
    },
    [hiddenHosts, hosts]
  )
  // Why: another worktree's menu may have changed the filter since this one mounted.
  const reloadHiddenHosts = useCallback(() => setHiddenHosts(readHiddenQuickCommandHosts()), [])
  return {
    showHostFilter,
    hiddenHosts,
    repoCommands: visibleRepoCommands,
    globalCommands: visibleGlobalCommands,
    toggleHost,
    reloadHiddenHosts
  }
}
