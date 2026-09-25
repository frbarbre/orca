import { shell } from 'electron'
import { recordUpdaterLifecycle } from '../updater-lifecycle-diagnostics'

const FORK_REPO_URL = 'https://github.com/frbarbre/orca'

/**
 * Whether this build can only be updated by hand.
 *
 * Why: macOS hands the swap to Squirrel.Mac, which refuses a bundle whose code signature it cannot
 * validate against the running app. This fork ships without a Developer ID, so downloading and
 * installing would spend the bandwidth and then fail at the last step — worse than not offering it.
 * Checking still works, because that is only an HTTP read of the feed manifest.
 *
 * Opt-in rather than defaulted on, and armed by the app entry point (see
 * `armManualInstallOnlyUpdates`) rather than here: the updater's own unit tests drive
 * download/install directly with `isPackaged` set, so a default-on flag would short-circuit the
 * machinery they exist to cover. Nothing arms it in a test run.
 *
 * Set ORCA_UPDATE_AUTO_INSTALL=1 to keep the normal download-and-install path once the build is
 * signed.
 */
export function isManualInstallOnlyUpdate(): boolean {
  return process.env.ORCA_UPDATE_MANUAL_INSTALL === '1'
}

/**
 * Turns on manual-install mode for a real installed build.
 *
 * Why an explicit arm step: it keeps the switch at the app's edge, so the updater modules stay
 * exactly as testable as upstream wrote them.
 */
export function armForkUpdateChannel(isPackaged: boolean): void {
  if (!isPackaged) {
    return
  }
  // Why set here rather than editing the URL constants: the updater's modules and their tests are
  // upstream's, and re-pointing the literals means editing nine test files and re-resolving them on
  // every merge. One env var at the edge leaves all of that untouched.
  process.env.ORCA_RELEASES_REPO_URL ??= FORK_REPO_URL
  process.env.ORCA_UPDATE_FEED_URL ??= `${process.env.ORCA_RELEASES_REPO_URL}/releases/latest/download`
  if (process.env.ORCA_UPDATE_AUTO_INSTALL !== '1') {
    process.env.ORCA_UPDATE_MANUAL_INSTALL = '1'
  }
}

/** Sends the user to the release page so they can install the new version themselves. */
export function openReleasePageForManualInstall(releaseUrl: string | undefined): void {
  const url = releaseUrl ?? `${process.env.ORCA_RELEASES_REPO_URL ?? FORK_REPO_URL}/releases/latest`
  recordUpdaterLifecycle(
    'manual_install_release_page_opened',
    { url },
    { level: 'info', message: 'Opened the release page for a manual install' }
  )
  void shell.openExternal(url)
}
