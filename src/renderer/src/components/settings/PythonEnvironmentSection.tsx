import type { Repo } from '../../../../shared/repo-types'
import { Label } from '../ui/label'
import { RepoSettingsDraftInput } from './RepositorySettingsDraftInput'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'

// Fork: the venv pyrefly runs in for Cmd+click go-to-definition in Python files.
export function PythonEnvironmentSection({
  repo,
  updateRepo,
  forceVisible
}: {
  repo: Repo
  updateRepo: (repoId: string, updates: Partial<Repo>) => void
  forceVisible?: boolean
}): React.JSX.Element {
  return (
    <SearchableSetting
      title={translate(
        'auto.components.settings.repository.search.pythonEnvironment',
        'Python Environment'
      )}
      description={translate(
        'auto.components.settings.repository.search.pythonEnvironmentDescription',
        'The venv pyrefly uses for go-to-definition in Python files.'
      )}
      keywords={[repo.displayName, 'python', 'venv', 'virtualenv', 'pyrefly', 'definition']}
      className="space-y-2"
      forceVisible={forceVisible}
    >
      <Label className="text-sm font-semibold">
        {translate(
          'auto.components.settings.repository.search.pythonEnvironment',
          'Python Environment'
        )}
      </Label>
      <RepoSettingsDraftInput
        repoId={repo.id}
        storeValue={repo.pythonVenvPath ?? ''}
        placeholder=".venv"
        onTextChange={() => {}}
        onBlur={(e) => {
          const pythonVenvPath = e.currentTarget.value.trim() || undefined
          if (pythonVenvPath !== (repo.pythonVenvPath || undefined)) {
            updateRepo(repo.id, { pythonVenvPath })
          }
        }}
        className="h-9 text-sm"
      />
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.PythonEnvironmentSection.hint',
          'Relative to the worktree, or absolute. Empty finds the nearest .venv. Cmd+click in a Python file runs pyrefly from this venv, or from PATH.'
        )}
      </p>
    </SearchableSetting>
  )
}
