import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

const KEEP_BACKUPS = 3

async function copyJsonTree(from: string, to: string): Promise<void> {
  const entries = await readdir(from, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const source = join(from, entry.name)
    if (entry.isDirectory()) {
      await copyJsonTree(source, join(to, entry.name))
      continue
    }
    if (!entry.name.endsWith('.json')) {
      continue
    }
    await mkdir(to, { recursive: true })
    await copyFile(source, join(to, entry.name))
  }
}

/**
 * Copies the settings and workspace state aside before the app is replaced.
 *
 * Why only JSON: those files are the whole of what a user would mind losing — projects,
 * workspaces, rules, preferences. The rest of userData is caches, session blobs and a sqlite
 * database that are rebuilt on demand, and copying them would turn a fast step into a slow one.
 *
 * An update does not normally touch userData at all. This is here for the case it does.
 */
export async function backupUserSettings(args: {
  userDataPath: string
  version: string
  now?: number
}): Promise<string | null> {
  const root = join(args.userDataPath, 'update-backups')
  const stamp = new Date(args.now ?? Date.now()).toISOString().replace(/[:.]/g, '-')
  const destination = join(root, `${args.version}-${stamp}`)
  try {
    await mkdir(destination, { recursive: true })
    await copyJsonTree(args.userDataPath, destination)
    await copyJsonTree(join(args.userDataPath, 'profiles'), join(destination, 'profiles'))
    await pruneOldBackups(root, destination)
    return destination
  } catch {
    // Why a failed backup does not stop the update: it is a precaution against a case that does
    // not normally arise, and refusing to update because of it would be the larger harm.
    return null
  }
}

async function pruneOldBackups(root: string, keepPath: string): Promise<void> {
  const entries = await readdir(root).catch(() => [])
  const directories: { path: string; createdAt: number }[] = []
  for (const name of entries) {
    const path = join(root, name)
    if (path === keepPath) {
      continue
    }
    const info = await stat(path).catch(() => null)
    if (info?.isDirectory()) {
      directories.push({ path, createdAt: info.birthtimeMs || info.mtimeMs })
    }
  }
  directories.sort((left, right) => right.createdAt - left.createdAt)
  for (const stale of directories.slice(KEEP_BACKUPS - 1)) {
    await rm(stale.path, { recursive: true, force: true })
  }
}
