import {
  isGitHubLogin,
  parseGitHubUserProfile,
  type GitHubUserProfile
} from '../../shared/github/github-user-profile'
import { acquire, ghExecFileAsync, release } from './gh-utils'

export async function getGitHubUserProfile(login: string): Promise<GitHubUserProfile | null> {
  if (!isGitHubLogin(login)) {
    return null
  }
  await acquire()
  try {
    const { stdout } = await ghExecFileAsync(['api', `users/${login}`], { encoding: 'utf-8' })
    return parseGitHubUserProfile(JSON.parse(stdout))
  } catch {
    return null
  } finally {
    release()
  }
}
