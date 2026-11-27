import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect } from '@stablyai/playwright-test'
import { PROTOCOL_VERSION } from '../../../src/main/daemon/types'

export function readDaemonPid(userDataDir: string): number {
  const raw = readFileSync(
    path.join(userDataDir, 'daemon', `daemon-v${PROTOCOL_VERSION}.pid`),
    'utf8'
  )
  const parsed = JSON.parse(raw) as { pid?: unknown }
  if (typeof parsed.pid !== 'number') {
    throw new Error(`Daemon pid file did not contain a numeric pid: ${raw}`)
  }
  return parsed.pid
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
      return false
    }
    throw error
  }
}

export async function terminateDaemonForColdRestart(pid: number): Promise<void> {
  if (!isProcessAlive(pid)) {
    return
  }
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'pipe',
        timeout: 10_000
      })
    } catch (error) {
      if (isProcessAlive(pid)) {
        throw error
      }
    }
  } else {
    try {
      process.kill(pid, 'SIGKILL')
    } catch (error) {
      // Tolerate ESRCH if the daemon exits between liveness check and signal, matching Windows revalidation.
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
        throw error
      }
    }
  }
  await expect
    .poll(() => isProcessAlive(pid), {
      timeout: 10_000,
      message: `daemon ${pid} remained alive after forced termination`
    })
    .toBe(false)
}
