import { isGeneratedCodePath } from '../../../../../../shared/generated-code-path'
import { isTestCodePath } from '../../../../../../shared/test-code-path'
import type {
  GitPathReviewAttributes,
  GitReviewAttributeName
} from '../../../../../../shared/git-review-attributes'
import type { SourceControlPathEntry } from './file-filter'

export const SOURCE_CONTROL_FILE_CATEGORIES = [
  'implementation',
  'test',
  'documentation',
  'generated',
  'agent-guidance',
  'localization',
  'assets'
] as const

export type SourceControlFileCategory = (typeof SOURCE_CONTROL_FILE_CATEGORIES)[number]

type PathAttributes = GitPathReviewAttributes[string]

// Why this order: when a path carries several categories, the most specific supporting role wins over implementation.
const ATTRIBUTE_PRECEDENCE: readonly [GitReviewAttributeName, SourceControlFileCategory][] = [
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
): SourceControlFileCategory[] {
  const present = new Set<SourceControlFileCategory>()
  for (const entries of pathLists) {
    for (const entry of entries) {
      present.add(classifySourceControlFilePath(entry.path, attributesByPath[entry.path]))
    }
  }
  return SOURCE_CONTROL_FILE_CATEGORIES.filter((category) => present.has(category))
}

export function filterSourceControlPathEntriesByCategory<T extends SourceControlPathEntry>(
  entries: T[],
  hiddenCategories: ReadonlySet<SourceControlFileCategory>,
  attributesByPath: GitPathReviewAttributes
): T[] {
  if (hiddenCategories.size === 0) {
    return entries
  }
  return entries.filter(
    (entry) =>
      !hiddenCategories.has(classifySourceControlFilePath(entry.path, attributesByPath[entry.path]))
  )
}
