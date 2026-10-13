import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runWorkspaceCommand } from './workspace-command'

describe.skipIf(process.platform === 'win32')('runWorkspaceCommand', () => {
  let dir: string

  beforeEach(() => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'orca-workspace-command-')))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('runs the command in the workspace folder', async () => {
    const result = await runWorkspaceCommand('pwd && echo stopped', dir)

    expect(result.success).toBe(true)
    expect(result.output).toContain(dir)
    expect(result.output).toContain('stopped')
  })

  it('reports a failing command with what it printed', async () => {
    const result = await runWorkspaceCommand('echo "docker: not running" >&2; exit 3', dir)

    expect(result.success).toBe(false)
    expect(result.output).toContain('docker: not running')
  })

  it('gives up on a command that outlives its deadline', async () => {
    const result = await runWorkspaceCommand('sleep 5', dir, 200)

    expect(result.success).toBe(false)
    expect(result.output).toContain('timed out')
  })
})
