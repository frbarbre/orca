// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import type { HostedTerminalQuickCommand } from '@/hooks/use-terminal-quick-command-hosts'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import {
  hideQuickCommandsOfHiddenHosts,
  readHiddenQuickCommandHosts,
  toggleQuickCommandHost,
  writeHiddenQuickCommandHosts
} from './quick-command-host-visibility'

function entry(hostId: ExecutionHostId, id: string): HostedTerminalQuickCommand {
  return {
    key: `${hostId}\0${id}`,
    hostId,
    hostLabel: hostId,
    command: { id, label: id, action: 'terminal-command', command: id, appendEnter: true }
  }
}

describe('quick command host visibility', () => {
  beforeEach(() => localStorage.clear())

  it('drops the commands of hidden hosts', () => {
    const commands = [entry('local', 'a'), entry('runtime:athena', 'b')]

    expect(hideQuickCommandsOfHiddenHosts(commands, ['local'])).toEqual([commands[1]])
    expect(hideQuickCommandsOfHiddenHosts(commands, [])).toBe(commands)
  })

  it('never hides the last visible host', () => {
    const hosts = ['local', 'runtime:athena']

    expect(toggleQuickCommandHost([], 'local', hosts)).toEqual(['local'])
    expect(toggleQuickCommandHost(['local'], 'runtime:athena', hosts)).toEqual(['local'])
    expect(toggleQuickCommandHost(['local'], 'local', hosts)).toEqual([])
  })

  it('remembers hidden hosts on this machine', () => {
    writeHiddenQuickCommandHosts(['runtime:athena'])

    expect(readHiddenQuickCommandHosts()).toEqual(['runtime:athena'])
  })

  it('reads nothing hidden from missing or malformed storage', () => {
    expect(readHiddenQuickCommandHosts()).toEqual([])
    localStorage.setItem('orca.quickCommands.hiddenHostIds', '{nope')
    expect(readHiddenQuickCommandHosts()).toEqual([])
  })
})
