export type ForkUpdateSwapPlan = {
  /** The running app, which cannot be replaced until it exits. */
  appPath: string
  pid: number
  zipPath: string
  stagingDir: string
  backupPath: string
  logPath: string
}

function quote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * The script that swaps the bundle after Orca has exited.
 *
 * Why a script outside the app at all: the bundle being replaced is the one running it, so the
 * work has to outlive the process. Spawned detached, it waits for the pid and then owns the swap.
 *
 * Why no `codesign` gate: this fork's bundles are ad-hoc signed without sealed resources, so
 * `codesign -v` already fails on a perfectly good install ("code has no resources but signature
 * indicates they must be present"). Integrity is the manifest's sha512, checked before this runs;
 * what is left to check here is that the archive expanded into something launchable.
 *
 * Why the old bundle is moved rather than deleted: a swap that fails half way leaves the machine
 * with no Orca at all. The backup stays on disk until the next update replaces it, so recovery is
 * one `mv` by hand.
 */
export function buildForkUpdateSwapScript(plan: ForkUpdateSwapPlan): string {
  const app = quote(plan.appPath)
  const staging = quote(plan.stagingDir)
  const backup = quote(plan.backupPath)
  return `#!/bin/bash
set -uo pipefail
exec >>${quote(plan.logPath)} 2>&1
echo "[orca-update] waiting for pid ${plan.pid} to exit"
while kill -0 ${plan.pid} 2>/dev/null; do sleep 0.2; done
# Why the extra pause: the process is gone before macOS has released every file handle in the bundle.
sleep 1

rm -rf ${staging}
mkdir -p ${staging}
if ! /usr/bin/ditto -x -k ${quote(plan.zipPath)} ${staging}; then
  echo "[orca-update] expand failed; keeping the installed app"
  /usr/bin/open -a ${app} || true
  exit 1
fi

NEW=${staging}/Orca.app
if [ ! -x "$NEW/Contents/MacOS/Orca" ] || ! /usr/bin/plutil -lint "$NEW/Contents/Info.plist" >/dev/null; then
  echo "[orca-update] the archive did not contain a launchable app; keeping the installed app"
  /usr/bin/open -a ${app} || true
  exit 1
fi
/usr/bin/xattr -dr com.apple.quarantine "$NEW" 2>/dev/null || true

rm -rf ${backup}
if ! mv ${app} ${backup}; then
  echo "[orca-update] could not move the installed app aside; keeping it"
  /usr/bin/open -a ${app} || true
  exit 1
fi
if ! mv "$NEW" ${app}; then
  echo "[orca-update] install failed; restoring the previous app"
  mv ${backup} ${app}
  /usr/bin/open -a ${app} || true
  exit 1
fi

rm -rf ${staging}
echo "[orca-update] installed; previous version kept at ${plan.backupPath}"
/usr/bin/open -a ${app}
`
}
