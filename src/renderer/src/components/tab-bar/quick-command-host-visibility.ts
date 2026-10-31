import type { HostedTerminalQuickCommand } from '@/hooks/use-terminal-quick-command-hosts'

const STORAGE_KEY = 'orca.quickCommands.hiddenHostIds'

// Why local storage: host ids name this machine's paired environments, so the choice stays here.
export function readHiddenQuickCommandHosts(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function writeHiddenQuickCommandHosts(hostIds: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hostIds))
  } catch {
    // A blocked store only forgets the choice on the next launch.
  }
}

export function toggleQuickCommandHost(
  hidden: readonly string[],
  hostId: string,
  hostIds: readonly string[]
): string[] {
  if (hidden.includes(hostId)) {
    return hidden.filter((id) => id !== hostId)
  }
  const stillVisible = hostIds.filter((id) => id !== hostId && !hidden.includes(id))
  return stillVisible.length > 0 ? [...hidden, hostId] : [...hidden]
}

export function hideQuickCommandsOfHiddenHosts(
  commands: readonly HostedTerminalQuickCommand[],
  hidden: readonly string[]
): readonly HostedTerminalQuickCommand[] {
  return hidden.length === 0 ? commands : commands.filter((entry) => !hidden.includes(entry.hostId))
}
