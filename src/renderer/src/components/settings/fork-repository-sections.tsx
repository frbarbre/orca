import type { Repo } from '../../../../shared/repo-types'
import { matchesSettingsSearch } from './settings-search'
import { PortLabelsCommandSection, getPortLabelsSearchEntry } from './PortLabelsCommandSection'
import { FlakyE2eRerunSection, getFlakyE2eRerunSearchEntry } from './FlakyE2eRerunSection'

// Fork: the repository settings the fork adds, laid out where the pane lists its sections.
export function forkRepositorySections({
  repo,
  searchQuery,
  forceVisible,
  updateRepo
}: {
  repo: Repo
  searchQuery: string
  forceVisible: boolean
  updateRepo: (repoId: string, updates: Partial<Repo>) => void
}): React.JSX.Element[] {
  const shows = (entry: ReturnType<typeof getPortLabelsSearchEntry>): boolean =>
    forceVisible || matchesSettingsSearch(searchQuery, [entry])
  return [
    shows(getPortLabelsSearchEntry(repo)) ? (
      <PortLabelsCommandSection
        key="port-labels"
        repo={repo}
        updateRepo={updateRepo}
        forceVisible={forceVisible}
      />
    ) : null,
    shows(getFlakyE2eRerunSearchEntry(repo)) ? (
      <FlakyE2eRerunSection
        key={`flaky-e2e-rerun:${repo.id}`}
        repo={repo}
        updateRepo={updateRepo}
        forceVisible={forceVisible}
      />
    ) : null
  ].filter((section): section is React.JSX.Element => section !== null)
}
