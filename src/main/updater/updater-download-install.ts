import { app } from 'electron'
import {
  beginMacUpdateDownload,
  deferMacQuitUntilInstallerReady,
  isMacInstallRequested,
  setMacInstallPreflightInProgress
} from '../updater-mac-install'
import { recordUpdaterLifecycle } from '../updater-lifecycle-diagnostics'
import { isExternallyManagedLinuxInstall } from '../linux-update-package-type'
import { LINUX_PACKAGE_EXTERNALLY_MANAGED_MESSAGE } from '../linux-package-downloaded-status'
import { QUIT_AND_INSTALL_DELAY_MS } from './updater-state'
import {
  isManualInstallOnlyUpdate,
  openReleasePageForManualInstall
} from './updater-manual-install'
import { isForkSelfInstallUpdate, runForkSelfInstall } from './fork-install/fork-self-install'
import { UpdaterRemoteStatus } from './updater-remote-status'
import { prepareThisProcessShipItStaging } from './shipit-leftover-recovery'

export abstract class UpdaterDownloadInstall extends UpdaterRemoteStatus {
  protected quitAndInstall(): void {
    // Why the self-install path has nothing to do here: it quits as soon as the swap script is
    // spawned, so an install request can only be a second click on a card that is already done.
    if (isForkSelfInstallUpdate()) {
      return
    }
    // Why here as well as in downloadUpdate: nothing was ever downloaded in manual-install mode, so
    // an install request can only have come from stale renderer state or a direct IPC call.
    if (isManualInstallOnlyUpdate()) {
      openReleasePageForManualInstall(this.getKnownReleaseUrl())
      return
    }
    if (
      this.localBuildSelectionInProgress ||
      this.pinnedBuildSelectionInProgress ||
      this.pendingQuitAndInstallTimer ||
      this.quitAndInstallInProgress ||
      isMacInstallRequested()
    ) {
      return
    }

    if (this.deferHeadlessServeInstall('install', this.getPendingInstallVersion())) {
      return
    }
    // A queued check must not repoint the feed while native staging or installation is pending.
    this.finishActiveUpdateCheckAttempt()
    this.clearBackgroundCheckLaunchPending()
    if (
      !this.isMacStagingDeferredToInstall() &&
      deferMacQuitUntilInstallerReady(
        this.currentStatus,
        this.hasInstallableDownloadedVersion(),
        () => this.getPendingInstallVersion(),
        (status) => this.sendStatus(status)
      )
    ) {
      return
    }

    if (process.platform === 'darwin') {
      setMacInstallPreflightInProgress(true)
    }
    // Defer quit one tick so the renderer can flush state before windows close.
    this.pendingQuitAndInstallTimer = setTimeout(() => {
      void this.performQuitAndInstall()
    }, QUIT_AND_INSTALL_DELAY_MS)
  }

  protected downloadUpdate(): void {
    if (isForkSelfInstallUpdate()) {
      this.startForkSelfInstall()
      return
    }
    // Why before the in-flight guards: this path does not download, so it has no state to guard —
    // it hands the user the release page and leaves the status on 'available' so the card stays.
    if (isManualInstallOnlyUpdate()) {
      openReleasePageForManualInstall(this.getKnownReleaseUrl())
      return
    }
    if (
      this.localBuildSelectionInProgress ||
      this.pinnedBuildSelectionInProgress ||
      this.pendingQuitAndInstallTimer ||
      this.quitAndInstallInProgress ||
      isMacInstallRequested() ||
      this.downloadInFlight
    ) {
      return
    }
    // Retain availableVersion after errors so Retry Download still works.
    const canStart =
      this.currentStatus.state === 'available' ||
      (this.currentStatus.state === 'error' && this.hasInstallableDownloadedVersion())
    if (!canStart) {
      return
    }
    const version =
      this.currentStatus.state === 'available' ? this.currentStatus.version : this.availableVersion
    if (!version) {
      return
    }
    // Enforce host installability in main for older renderers and direct IPC callers.
    if (isExternallyManagedLinuxInstall()) {
      recordUpdaterLifecycle('linux_package_externally_managed_download_blocked', {
        version
      })
      // A refused Linux pin still owns the release feed; unwind it or background checks remain disabled.
      this.clearAvailableUpdateContext()
      this.restoreReleaseUpdateSource()
      this.sendStatus({
        state: 'error',
        message: LINUX_PACKAGE_EXTERNALLY_MANAGED_MESSAGE,
        version,
        retryable: false
      })
      return
    }
    if (this.deferHeadlessServeInstall('download', version)) {
      return
    }
    this.downloadInFlight = true
    const localBuildDownload = this.activeUpdateSource === 'local'
    beginMacUpdateDownload()
    // Acknowledge acceptance before setup delays progress events so the card responds immediately.
    this.sendStatus({ state: 'downloading', percent: 0, version })
    const startDownload = (): void => {
      this.getAutoUpdater()
        .downloadUpdate()
        .catch((err) => {
          this.downloadInFlight = false
          const message = String(err?.message ?? err)
          if (localBuildDownload) {
            this.sendLocalBuildErrorAndRestore(message)
          } else {
            this.sendErrorStatus(message)
          }
        })
    }
    // Prepare before download because Squirrel stages on completion unless staging is deferred to install.
    const preparingStaging = this.isMacStagingDeferredToInstall()
      ? null
      : prepareThisProcessShipItStaging()
    if (preparingStaging) {
      void preparingStaging.then(startDownload)
    } else {
      startDownload()
    }
  }

  /** Downloads the release, stages the bundle swap, and quits so the swap can run. */
  private startForkSelfInstall(): void {
    if (this.downloadInFlight) {
      return
    }
    const version =
      this.currentStatus.state === 'available' ? this.currentStatus.version : this.availableVersion
    if (!version) {
      return
    }
    this.downloadInFlight = true
    this.sendStatus({ state: 'downloading', percent: 0, version })
    void runForkSelfInstall(version, {
      onProgress: (percent) => this.sendStatus({ state: 'downloading', percent, version }),
      onError: (message) => {
        this.downloadInFlight = false
        // Why retryable: every failure here is a download or a staging step, all of which are
        // worth a second attempt, and the installed app has not been touched yet.
        this.sendStatus({ state: 'error', message, version, retryable: true })
      },
      onReadyToQuit: () => {
        this.downloadInFlight = false
        this.quittingForUpdate = true
        this.sendStatus({ state: 'downloaded', version })
        // Why the delay: the renderer needs a tick to show the card settling before windows go.
        setTimeout(() => app.quit(), QUIT_AND_INSTALL_DELAY_MS)
      }
    })
  }

  protected isQuittingForUpdate(): boolean {
    return this.quittingForUpdate
  }
}
