import { useEffect, useState } from 'react'

export type GitHubViewerIdentity = { login: string; avatarUrl: string }

let cached: GitHubViewerIdentity | null = null

/**
 * Who the signed-in reviewer is, so a queued comment can be shown under their own
 * name and face rather than a placeholder.
 *
 * Why the avatar is derived: `gh` reports the login, not the picture, and
 * `github.com/<login>.png` is the same fallback the comment rows already use.
 */
export function useGitHubViewer(): GitHubViewerIdentity | null {
  const [viewer, setViewer] = useState<GitHubViewerIdentity | null>(cached)

  useEffect(() => {
    if (cached) {
      return
    }
    let disposed = false
    void window.api.gh
      .viewer()
      .then((result) => {
        if (disposed || !result?.login) {
          return
        }
        cached = { login: result.login, avatarUrl: `https://github.com/${result.login}.png` }
        setViewer(cached)
      })
      .catch(() => undefined)
    return () => {
      disposed = true
    }
  }, [])

  return viewer
}
