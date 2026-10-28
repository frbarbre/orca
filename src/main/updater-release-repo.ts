// Fork: every release URL derives from one base, defaulting to upstream, so a fork overrides only the slug.
// Functions, not consts: a module-level env read runs before the app entry can arm the fork channel.
function repoBase(): string {
  return process.env.ORCA_RELEASES_REPO_URL ?? 'https://github.com/stablyai/orca'
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function atomFeedUrl(): string {
  return `${repoBase()}/releases.atom`
}

export function releasesDownloadBase(): string {
  return `${repoBase()}/releases/download`
}

export function latestReleaseUrl(): string {
  return `${repoBase()}/releases/latest`
}

/** Atom includes stable and prerelease tags without channel filtering. */
export function tagHrefPattern(): RegExp {
  return new RegExp(`href="${escapeForRegExp(repoBase())}/releases/tag/([^"]+)"`, 'g')
}

export function releaseDownloadUrlPattern(): RegExp {
  return new RegExp(`^${escapeForRegExp(releasesDownloadBase())}/`, 'i')
}

export function releaseTagPathPattern(): RegExp {
  return new RegExp(`^${escapeForRegExp(new URL(repoBase()).pathname)}/releases/tag/([^/]+)$`)
}
