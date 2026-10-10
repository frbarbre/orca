import {
  getPreparedQuickOpenFiles,
  rankQuickOpenFiles,
  QUICK_OPEN_RESULT_LIMIT
} from './quick-open-search'

const CANDIDATE_LIMIT = QUICK_OPEN_RESULT_LIMIT * 4

function fileNameQuery(query: string): string {
  const last = query.trim().replace(/\\/g, '/').toLowerCase().split(/\s+/).at(-1) ?? ''
  return last.slice(last.lastIndexOf('/') + 1)
}

function isSubsequence(query: string, text: string): boolean {
  let index = 0
  for (const char of text) {
    if (char === query[index]) {
      index++
    }
  }
  return index === query.length
}

function fileNameTier(query: string, path: string): number {
  if (!query) {
    return 0
  }
  const normalized = path.replace(/\\/g, '/').toLowerCase()
  const name = normalized.slice(normalized.lastIndexOf('/') + 1)
  if (name === query) {
    return 0
  }
  if (name.startsWith(query)) {
    return 1
  }
  if (name.includes(query)) {
    return 2
  }
  return isSubsequence(query, name) ? 3 : 4
}

const DEPENDENCY_FOLDER = /(^|\/)(node_modules|\.venv|venv|site-packages|vendor|\.git)\//

function isDependencyPath(path: string): boolean {
  return DEPENDENCY_FOLDER.test(path.replace(/\\/g, '/'))
}

// Why tiers before history: a recent file that only matches through its folders must not
// outrank a file whose name is the query, as in VS Code.
export function rankQuickOpenFilesWithHistory(
  query: string,
  files: readonly string[],
  history: readonly string[]
): { path: string; score: number }[] {
  const available = new Set(files)
  const eligibleHistory = history.filter((path) => available.has(path))
  const recent = rankQuickOpenFiles(
    query,
    getPreparedQuickOpenFiles(eligibleHistory),
    eligibleHistory.length
  )
  const recency = new Map(eligibleHistory.map((path, index) => [path, index]))
  recent.sort((a, b) => (recency.get(a.path) ?? 0) - (recency.get(b.path) ?? 0))
  const recentPaths = new Set(recent.map((item) => item.path))
  const ranked = [
    ...recent,
    ...rankQuickOpenFiles(query, getPreparedQuickOpenFiles(files), CANDIDATE_LIMIT).filter(
      (item) => !recentPaths.has(item.path)
    )
  ]
  const nameQuery = fileNameQuery(query)
  const tiers = new Map(
    ranked.map((item) => [
      item.path,
      fileNameTier(nameQuery, item.path) * 2 + (isDependencyPath(item.path) ? 1 : 0)
    ])
  )
  const order = new Map(ranked.map((item, index) => [item.path, index]))
  return ranked
    .sort(
      (a, b) =>
        (tiers.get(a.path) ?? 0) - (tiers.get(b.path) ?? 0) ||
        (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0)
    )
    .slice(0, QUICK_OPEN_RESULT_LIMIT)
}
