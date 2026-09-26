import { describe, expect, it } from 'vitest'
import { buildForkUpdateSwapScript } from './fork-update-swap-script'

const plan = {
  appPath: '/Applications/Orca.app',
  pid: 4242,
  zipPath: '/tmp/orca/Orca-1.4.229-arm64-mac.zip',
  stagingDir: '/tmp/orca/staging',
  backupPath: '/Applications/Orca.app.previous',
  logPath: '/tmp/orca/swap.log'
}

describe('buildForkUpdateSwapScript', () => {
  it('waits for the running app to exit before touching the bundle', () => {
    const script = buildForkUpdateSwapScript(plan)
    const wait = script.indexOf('kill -0 4242')
    const move = script.indexOf("mv '/Applications/Orca.app'")
    expect(wait).toBeGreaterThan(-1)
    expect(move).toBeGreaterThan(wait)
  })

  it('keeps the previous bundle instead of deleting it', () => {
    expect(buildForkUpdateSwapScript(plan)).toContain(
      "mv '/Applications/Orca.app' '/Applications/Orca.app.previous'"
    )
  })

  it('restores the previous bundle when the install move fails', () => {
    expect(buildForkUpdateSwapScript(plan)).toContain(
      "mv '/Applications/Orca.app.previous' '/Applications/Orca.app'"
    )
  })

  it('refuses an archive that did not expand into a launchable app', () => {
    const script = buildForkUpdateSwapScript(plan)
    expect(script).toContain('Contents/MacOS/Orca')
    expect(script).toContain('plutil -lint')
  })

  it('strips quarantine so the replacement opens without a Gatekeeper prompt', () => {
    expect(buildForkUpdateSwapScript(plan)).toContain('xattr -dr com.apple.quarantine')
  })

  // Why: these paths come from app.getPath, and a user directory can hold a quote.
  it('quotes every path it is handed', () => {
    const script = buildForkUpdateSwapScript({ ...plan, appPath: "/Applications/O'rca.app" })
    expect(script).toContain(`'/Applications/O'\\''rca.app'`)
  })
})
