import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }))

const UPSTREAM = 'https://github.com/stablyai/orca'
const FORK = 'https://github.com/frbarbre/orca'

/**
 * The fork selects its own release repo through ORCA_RELEASES_REPO_URL, armed by the app entry at
 * startup. ES imports are evaluated before the importing module's body, so reading that variable at
 * module scope resolved it before the arming ran — and a fork build silently checked upstream's
 * releases, offering an upstream version with an upstream release-notes link.
 *
 * These assert the read is deferred to call time. A module-level `const` passes nothing here.
 */
describe('fork release feed resolution', () => {
  afterEach(() => {
    delete process.env.ORCA_RELEASES_REPO_URL
    vi.resetModules()
  })

  it('defaults to upstream so the module behaves as upstream wrote it', async () => {
    delete process.env.ORCA_RELEASES_REPO_URL
    vi.resetModules()
    const { getReleaseDownloadUrl } = await import('./updater-prerelease-feed')
    expect(getReleaseDownloadUrl('v1.0.0')).toBe(`${UPSTREAM}/releases/download/v1.0.0`)
  })

  it('honours an override set before the module is imported', async () => {
    process.env.ORCA_RELEASES_REPO_URL = FORK
    vi.resetModules()
    const { getReleaseDownloadUrl } = await import('./updater-prerelease-feed')
    expect(getReleaseDownloadUrl('v1.0.0')).toBe(`${FORK}/releases/download/v1.0.0`)
  })

  it('honours an override set after the module is imported', async () => {
    // Why this is the regression: the app entry arms the variable inside a function body, which runs
    // after every import in its graph has already been evaluated.
    delete process.env.ORCA_RELEASES_REPO_URL
    vi.resetModules()
    const { getReleaseDownloadUrl } = await import('./updater-prerelease-feed')
    expect(getReleaseDownloadUrl('v1.0.0')).toBe(`${UPSTREAM}/releases/download/v1.0.0`)

    process.env.ORCA_RELEASES_REPO_URL = FORK
    expect(getReleaseDownloadUrl('v1.0.0')).toBe(`${FORK}/releases/download/v1.0.0`)
  })
})
