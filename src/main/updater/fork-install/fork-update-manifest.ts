import { arch } from 'node:process'

export type ForkUpdateAsset = {
  fileName: string
  sha512: string
  size: number
}

/**
 * The assets electron-builder lists in `latest-mac.yml`, newest release first.
 *
 * Why hand-parsed: the manifest is three flat fields per entry and no YAML parser ships in
 * the app's runtime dependencies. A parser added for this would be a dependency carried into
 * every build for one file whose shape electron-builder writes the same way every time.
 */
export function parseForkUpdateManifest(manifest: string): ForkUpdateAsset[] {
  const assets: ForkUpdateAsset[] = []
  let current: Partial<ForkUpdateAsset> = {}
  for (const line of manifest.split('\n')) {
    const url = /^\s*-\s*url:\s*(\S+)\s*$/.exec(line)
    if (url) {
      current = { fileName: url[1] }
      continue
    }
    const sha512 = /^\s*sha512:\s*(\S+)\s*$/.exec(line)
    if (sha512 && current.fileName) {
      current.sha512 = sha512[1]
      continue
    }
    const size = /^\s*size:\s*(\d+)\s*$/.exec(line)
    if (size && current.fileName && current.sha512) {
      assets.push({ fileName: current.fileName, sha512: current.sha512, size: Number(size[1]) })
      current = {}
    }
  }
  return assets
}

/**
 * The zip built for this machine.
 *
 * Why the zip and not the dmg: it expands with `ditto` straight into a directory, where a dmg
 * needs mounting, and it is the artifact electron-builder already hashes in the manifest.
 */
export function selectForkUpdateAsset(
  assets: readonly ForkUpdateAsset[],
  machineArch: string = arch
): ForkUpdateAsset | null {
  const zips = assets.filter((asset) => asset.fileName.endsWith('-mac.zip'))
  const wantsArm = machineArch === 'arm64'
  const match = zips.find((asset) =>
    wantsArm ? asset.fileName.includes('-arm64-') : !asset.fileName.includes('-arm64-')
  )
  return match ?? null
}
