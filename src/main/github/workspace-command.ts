import { spawn } from 'node:child_process'
import type { WorkspaceCommandResult } from '../../shared/github/workspace-command'

const DEFAULT_TIMEOUT_MS = 5 * 60_000
const MAX_OUTPUT_CHARS = 4000

// Fork: runs a PR-rule command (e.g. stopping the workspace's dev stack) the way setup hooks run,
// with the app's environment and bash, headless because the workspace may have no mounted terminal.
export function runWorkspaceCommand(
  command: string,
  cwd: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<WorkspaceCommandResult> {
  return new Promise((resolve) => {
    let output = ''
    let settled = false
    const append = (chunk: Buffer): void => {
      output = (output + chunk.toString('utf8')).slice(-MAX_OUTPUT_CHARS)
    }
    const settle = (result: WorkspaceCommandResult): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(deadline)
      resolve(result)
    }
    const child = spawn(command, {
      cwd,
      shell: process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/bash',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      ...(process.platform === 'win32' ? {} : { detached: true })
    })
    const deadline = setTimeout(() => {
      // Why the group: the shell's children (docker compose, moon) would outlive a plain kill.
      if (child.pid !== undefined && process.platform !== 'win32') {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          child.kill('SIGKILL')
        }
      } else {
        child.kill('SIGKILL')
      }
      settle({ success: false, output: `${output}\nThe command timed out.`.trim() })
    }, timeoutMs)
    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.on('error', (error) => settle({ success: false, output: error.message }))
    child.on('close', (code) => settle({ success: code === 0, output: output.trim() }))
  })
}
