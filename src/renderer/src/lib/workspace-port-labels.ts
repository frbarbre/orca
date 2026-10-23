import { useEffect, useState } from 'react'

export type PortLabel = { label: string; url: string; port: number }

const LABELLED_URL = /^\s*(\S.*?)\s+(https?:\/\/\S+)\s*$/
const NO_LABELS: PortLabel[] = []

function portOf(url: string): number | null {
  try {
    const parsed = new URL(url)
    if (parsed.port) {
      return Number(parsed.port)
    }
    return parsed.protocol === 'https:' ? 443 : 80
  } catch {
    return null
  }
}

/** Fork: each `Label  URL` line a repo's URLs command prints, so any entry it adds just shows up. */
export function parsePortLabels(output: string): PortLabel[] {
  const byPort = new Map<number, PortLabel>()
  for (const line of output.split('\n')) {
    const match = LABELLED_URL.exec(line)
    const label = match?.[1]?.trim()
    const url = match?.[2]
    const port = url ? portOf(url) : null
    if (label && url && port !== null && !byPort.has(port)) {
      byPort.set(port, { label, url, port })
    }
  }
  return [...byPort.values()]
}

export function pickFrontendPortLabel(
  labels: readonly PortLabel[],
  livePorts: readonly number[]
): PortLabel | null {
  const frontends = labels.filter((entry) => /frontend/i.test(entry.label))
  if (frontends.length === 0) {
    return labels[0] && livePorts.includes(labels[0].port) ? labels[0] : null
  }
  // Why the first running one: a repo can list several, such as a dev server and a prebuild.
  return frontends.find((entry) => livePorts.includes(entry.port)) ?? null
}

const cache = new Map<string, { key: string; labels: PortLabel[] }>()

/** The labels last read for `worktreeId`, for actions that run outside a mounted component. */
export function cachedWorktreePortLabels(worktreeId: string): PortLabel[] {
  return cache.get(worktreeId)?.labels ?? NO_LABELS
}

/** Runs the repo's URLs command in the workspace, again only when the command or live ports change. */
export function useWorktreePortLabels(
  worktreeId: string | null,
  worktreePath: string | null,
  command: string | undefined,
  livePorts: readonly number[]
): PortLabel[] {
  const key = command ? `${command}\0${[...livePorts].sort((a, b) => a - b).join(',')}` : ''
  const cached = worktreeId ? cache.get(worktreeId) : undefined
  const [labels, setLabels] = useState<PortLabel[]>(cached?.labels ?? NO_LABELS)
  useEffect(() => {
    if (!worktreeId || !worktreePath || !command || livePorts.length === 0) {
      return
    }
    const hit = cache.get(worktreeId)
    if (hit?.key === key) {
      setLabels(hit.labels)
      return
    }
    let cancelled = false
    void window.api.reviewStatusRules
      .runWorkspaceCommand({ worktreePath, command })
      .then((result) => {
        const next = parsePortLabels(result.output)
        cache.set(worktreeId, { key, labels: next })
        if (!cancelled) {
          setLabels(next)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [command, key, livePorts.length, worktreeId, worktreePath])
  return command ? labels : NO_LABELS
}
