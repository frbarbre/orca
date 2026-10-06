import { iterateNulDelimitedFields } from './nul-delimited-fields'

export const GIT_REVIEW_ATTRIBUTE_NAMES = [
  'review-implementation',
  'review-test',
  'review-documentation',
  'review-generated',
  'review-agent-guidance',
  'review-localization',
  'review-assets',
  'linguist-generated',
  'linguist-documentation'
] as const

export type GitReviewAttributeName = (typeof GIT_REVIEW_ATTRIBUTE_NAMES)[number]

export type GitReviewAttributeState = 'set' | 'unset'

export type GitPathReviewAttributes = Record<
  string,
  Partial<Record<GitReviewAttributeName, GitReviewAttributeState>>
>

export const GIT_CHECK_ATTR_TIMEOUT_MS = 15_000
export const GIT_CHECK_ATTR_MAX_PATHS = 2000

export const GIT_CHECK_ATTR_STDIN_ARGS = [
  '-c',
  'core.quotePath=false',
  'check-attr',
  '-z',
  '--stdin',
  ...GIT_REVIEW_ATTRIBUTE_NAMES
] as const

const REVIEW_ATTRIBUTE_NAME_SET: ReadonlySet<string> = new Set(GIT_REVIEW_ATTRIBUTE_NAMES)

function isGitReviewAttributeName(name: string): name is GitReviewAttributeName {
  return REVIEW_ATTRIBUTE_NAME_SET.has(name)
}

function toAttributeState(info: string): GitReviewAttributeState | null {
  if (info === 'set' || info === 'true') {
    return 'set'
  }
  if (info === 'unset' || info === 'false') {
    return 'unset'
  }
  return null
}

export function normalizeGitPathReviewAttributes(value: unknown): GitPathReviewAttributes {
  const result: GitPathReviewAttributes = {}
  if (typeof value !== 'object' || value === null) {
    return result
  }
  for (const [path, attributes] of Object.entries(value)) {
    if (typeof attributes !== 'object' || attributes === null) {
      continue
    }
    for (const [attribute, info] of Object.entries(attributes)) {
      const state = typeof info === 'string' ? toAttributeState(info) : null
      if (state && isGitReviewAttributeName(attribute)) {
        result[path] = { ...result[path], [attribute]: state }
      }
    }
  }
  return result
}

export function encodeGitCheckAttrPaths(paths: readonly string[]): string {
  return `${paths.join('\0')}\0`
}

export function parseGitCheckAttrOutput(stdout: string): GitPathReviewAttributes {
  const fields = Array.from(iterateNulDelimitedFields(stdout))
  const result: GitPathReviewAttributes = {}
  for (let index = 0; index + 2 < fields.length; index += 3) {
    const [path, attribute, info] = [fields[index], fields[index + 1], fields[index + 2]]
    const state = toAttributeState(info)
    if (!path || !state || !isGitReviewAttributeName(attribute)) {
      continue
    }
    result[path] = { ...result[path], [attribute]: state }
  }
  return result
}
