import type { Repo } from '../../../../shared/repo-types'
import { matchesSettingsSearch, type SettingsSearchEntry } from './settings-search'
import { PortLabelsCommandSection, getPortLabelsSearchEntry } from './PortLabelsCommandSection'
import { CiTriageSection, getCiTriageSearchEntry } from './CiTriageSection'

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
  const shows = (entry: SettingsSearchEntry): boolean =>
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
    shows(getCiTriageSearchEntry(repo)) ? (
      <CiTriageSection
        key={`ci-triage:${repo.id}`}
        repo={repo}
        updateRepo={updateRepo}
        forceVisible={forceVisible}
      />
    ) : null
  ].filter((section): section is React.JSX.Element => section !== null)
}
