import type { MentionOption } from '@/components/pull-request-page/page-types'
import { fileMentionOptions } from './github-mention-autocomplete'
import { filterGitHubMentionOptions } from './github-mention-option-filter'

const GITHUB_LOGIN_QUERY = /^[A-Za-z0-9-]*$/

/** What `@` offers in a box that names both people and workspace files: people first. */
export function composerMentionSuggestions({
  query,
  people,
  files
}: {
  query: string
  people: readonly MentionOption[]
  files: readonly string[]
}): MentionOption[] {
  const matchingPeople = GITHUB_LOGIN_QUERY.test(query)
    ? filterGitHubMentionOptions(people, query)
    : []
  // Why no second filter for files: the file search already ranked them fuzzily.
  return [...matchingPeople, ...fileMentionOptions(files)]
}
