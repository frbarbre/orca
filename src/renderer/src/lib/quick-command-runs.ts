import type { PtyRunningWorkVerdict } from '@/components/terminal/pty-running-work-probe'

const POLL_MS = 2000
// Why: a command that ends before the first poll is never seen running, and a fresh tab's shell
// may not have started it yet; an idle terminal this long after the run means it is done.
const UNSEEN_RUN_GRACE_MS = 5000

export type QuickCommandRunProbe = () => Promise<PtyRunningWorkVerdict | 'gone'>

type Run = { label: string; startedAt: number; sawLive: boolean }

const runsByTerminalId = new Map<string, Run>()

export function quickCommandRunningIn(terminalId: string): string | null {
  return runsByTerminalId.get(terminalId)?.label ?? null
}

export function trackQuickCommandRun(
  terminalId: string,
  label: string,
  probe: QuickCommandRunProbe
): void {
  const run: Run = { label, startedAt: Date.now(), sawLive: false }
  runsByTerminalId.set(terminalId, run)
  const tick = async (): Promise<void> => {
    if (runsByTerminalId.get(terminalId) !== run) {
      return
    }
    const verdict = await probe()
    if (runsByTerminalId.get(terminalId) !== run) {
      return
    }
    if (verdict === 'live') {
      run.sawLive = true
    }
    const done =
      verdict === 'gone' ||
      (verdict === 'exited' && (run.sawLive || Date.now() - run.startedAt >= UNSEEN_RUN_GRACE_MS))
    if (done) {
      runsByTerminalId.delete(terminalId)
      return
    }
    setTimeout(() => void tick(), POLL_MS)
  }
  setTimeout(() => void tick(), POLL_MS)
}
