import { isGeneratedCodePath } from '../../../../../../shared/generated-code-path'
import { isTestCodePath } from '../../../../../../shared/test-code-path'
import type {
  GitPathReviewAttributes,
  GitReviewAttributeName
} from '../../../../../../shared/git-review-attributes'
import type { SourceControlPathEntry } from './file-filter'

export const SOURCE_CONTROL_FILE_CATEGORIES = [
  'implementation',
  'imports',
  'test',
  'documentation',
  'generated',
  'lint-baseline',
  'agent-guidance',
  'localization',
  'assets'
] as const

export type SourceControlFileCategory = (typeof SOURCE_CONTROL_FILE_CATEGORIES)[number]

// Fork: flowbase's two apps, so a review can look at one side at a time.
const AREA_PREFIXES = { backend: 'apps/backend/', frontend: 'apps/frontend/' } as const

export type SourceControlFileArea = keyof typeof AREA_PREFIXES

export const SOURCE_CONTROL_FILE_AREAS = Object.keys(AREA_PREFIXES) as SourceControlFileArea[]

/** What the Changes filter can hide: a file type, or an area a file lies in. */
export type SourceControlFileFilterKey = SourceControlFileCategory | SourceControlFileArea

export function isSourceControlFileArea(
  key: SourceControlFileFilterKey
): key is SourceControlFileArea {
  return Object.hasOwn(AREA_PREFIXES, key)
}

export function sourceControlFileArea(path: string): SourceControlFileArea | null {
  return SOURCE_CONTROL_FILE_AREAS.find((area) => path.startsWith(AREA_PREFIXES[area])) ?? null
}

// Fork: lint baselines (hemolint's `.hemolint/`, `.steiger-baseline/`, `.file-lines-baseline.json`)
// churn with every fix and say nothing about the change itself.
const LINT_BASELINE_SEGMENT = /(?:^|\/)(?:\.hemolint|\.[^/]*baseline[^/]*)(?:\/|$)/i

type PathAttributes = GitPathReviewAttributes[string]

// Why this order: when a path carries several categories, the most specific supporting role wins over implementation.
const ATTRIBUTE_PRECEDENCE: readonly [GitReviewAttributeName, SourceControlFileCategory][] = [
  // Fork: a change that only touches imports is noise to a review whatever the file is.
  ['review-imports', 'imports'],
  ['review-generated', 'generated'],
  ['review-test', 'test'],
  ['review-documentation', 'documentation'],
  ['review-agent-guidance', 'agent-guidance'],
  ['review-localization', 'localization'],
  ['review-assets', 'assets'],
  ['review-implementation', 'implementation'],
  ['linguist-generated', 'generated'],
  ['linguist-documentation', 'documentation']
]

const ATTRIBUTES_BY_CATEGORY = new Map<SourceControlFileCategory, GitReviewAttributeName[]>()
for (const [attribute, category] of ATTRIBUTE_PRECEDENCE) {
  ATTRIBUTES_BY_CATEGORY.set(category, [...(ATTRIBUTES_BY_CATEGORY.get(category) ?? []), attribute])
}

function classifyByPathHeuristic(path: string): SourceControlFileCategory {
  if (LINT_BASELINE_SEGMENT.test(path)) {
    return 'lint-baseline'
  }
  if (isGeneratedCodePath(path)) {
    return 'generated'
  }
  if (isTestCodePath(path)) {
    return 'test'
  }
  return 'implementation'
}

export function classifySourceControlFilePath(
  path: string,
  attributes?: PathAttributes
): SourceControlFileCategory {
  if (attributes) {
    for (const [attribute, category] of ATTRIBUTE_PRECEDENCE) {
      if (attributes[attribute] === 'set') {
        return category
      }
    }
  }
  const heuristic = classifyByPathHeuristic(path)
  const removed = ATTRIBUTES_BY_CATEGORY.get(heuristic)?.some(
    (attribute) => attributes?.[attribute] === 'unset'
  )
  return removed ? 'implementation' : heuristic
}

export function collectSourceControlFileCategories(
  pathLists: readonly (readonly SourceControlPathEntry[])[],
  attributesByPath: GitPathReviewAttributes
): SourceControlFileFilterKey[] {
  const present = new Set<SourceControlFileFilterKey>()
  for (const entries of pathLists) {
    for (const entry of entries) {
      present.add(classifySourceControlFilePath(entry.path, attributesByPath[entry.path]))
      const area = sourceControlFileArea(entry.path)
      if (area) {
        present.add(area)
      }
    }
  }
  return [...SOURCE_CONTROL_FILE_CATEGORIES, ...SOURCE_CONTROL_FILE_AREAS].filter((key) =>
    present.has(key)
  )
}

export function filterSourceControlPathEntriesByCategory<T extends SourceControlPathEntry>(
  entries: T[],
  hiddenCategories: ReadonlySet<SourceControlFileFilterKey>,
  attributesByPath: GitPathReviewAttributes
): T[] {
  if (hiddenCategories.size === 0) {
    return entries
  }
  return entries.filter((entry) => {
    const area = sourceControlFileArea(entry.path)
    return (
      !hiddenCategories.has(
        classifySourceControlFilePath(entry.path, attributesByPath[entry.path])
      ) && !(area && hiddenCategories.has(area))
    )
  })
}
