import { spawn } from 'node:child_process'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { recordUpdaterLifecycle } from '../../updater-lifecycle-diagnostics'
import { backupUserSettings } from './fork-update-backup'
import { downloadForkUpdateArchive, fetchForkUpdateText } from './fork-update-download'
import { parseForkUpdateManifest, selectForkUpdateAsset } from './fork-update-manifest'
import { buildForkUpdateSwapScript } from './fork-update-swap-script'

const FORK_REPO_URL = 'https://github.com/frbarbre/orca'

/**
 * Whether this build installs its own updates rather than sending the user to the release page.
 *
 * Why it is a separate mode from manual-install: the blocker was never the download, it was
 * Squirrel.Mac refusing an unsigned bundle. Replacing the bundle directly sidesteps Squirrel
 * entirely, so the fork can install while still shipping without a Developer ID.
 */
export function isForkSelfInstallUpdate(): boolean {
  return process.env.ORCA_UPDATE_SELF_INSTALL === '1'
}

function feedBase(): string {
  return (
    process.env.ORCA_UPDATE_FEED_URL ??
    `${process.env.ORCA_RELEASES_REPO_URL ?? FORK_REPO_URL}/releases/latest/download`
  )
}

export type ForkSelfInstallHandlers = {
  onProgress: (percent: number) => void
  onError: (message: string) => void
  onReadyToQuit: () => void
}

/**
 * Downloads the new version, stages the swap, and hands the machine to a script that outlives us.
 *
 * The app cannot replace its own bundle while it is running, so the last thing this does is spawn
 * a detached script that waits for this process to exit and then does the work.
 */
export async function runForkSelfInstall(
  version: string,
  handlers: ForkSelfInstallHandlers
): Promise<void> {
  try {
    const manifest = await fetchForkUpdateText(`${feedBase()}/latest-mac.yml`)
    const asset = selectForkUpdateAsset(parseForkUpdateManifest(manifest))
    if (!asset) {
      handlers.onError('The release has no build for this machine.')
      return
    }
    const workDir = join(app.getPath('userData'), 'fork-updates')
    await mkdir(workDir, { recursive: true })
    const zipPath = join(workDir, asset.fileName)
    await downloadForkUpdateArchive({
      url: `${feedBase()}/${asset.fileName}`,
      destination: zipPath,
      expectedSha512: asset.sha512,
      expectedSize: asset.size,
      onProgress: handlers.onProgress
    })
    const backupPath = await backupUserSettings({
      userDataPath: app.getPath('userData'),
      version
    })
    const appPath = resolveInstalledAppPath()
    if (!appPath) {
      handlers.onError('Could not find the installed application bundle to replace.')
      return
    }
    const scriptPath = join(workDir, 'swap.sh')
    await writeFile(
      scriptPath,
      buildForkUpdateSwapScript({
        appPath,
        pid: process.pid,
        zipPath,
        stagingDir: join(workDir, 'staging'),
        backupPath: `${appPath}.previous`,
        logPath: join(workDir, 'swap.log')
      }),
      'utf8'
    )
    await chmod(scriptPath, 0o755)
    recordUpdaterLifecycle(
      'fork_self_install_staged',
      { version, appPath, settingsBackup: backupPath ?? 'none' },
      { level: 'info', message: 'Staged a fork self-install and handed off to the swap script' }
    )
    // Why detached with its own session: the script has to survive this process exiting, which is
    // the very thing it is waiting for.
    spawn('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' }).unref()
    handlers.onReadyToQuit()
  } catch (error) {
    handlers.onError(error instanceof Error ? error.message : String(error))
  }
}

/** `/Applications/Orca.app` for a packaged build, from the running executable's path. */
export function resolveInstalledAppPath(execPath: string = app.getPath('exe')): string | null {
  const marker = '.app/Contents/MacOS/'
  const index = execPath.indexOf(marker)
  if (index === -1) {
    return null
  }
  return execPath.slice(0, index + '.app'.length)
}
