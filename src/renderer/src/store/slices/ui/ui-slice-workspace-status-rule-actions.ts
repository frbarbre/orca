import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import {
  cloneDefaultWorkspaceStatusRuleConfig,
  isHandledKeyForPullRequest,
  normalizeWorkspaceStatusRuleConfig
} from '../../../../../shared/workspace-status-rule-config'

export function createUiWorkspaceStatusRuleActions(
  set: UISliceSet,
  get: UISliceGet
): Pick<
  UISlice,
  | 'workspaceStatusRules'
  | 'setWorkspaceStatusRules'
  | 'markPullRequestHandled'
  | 'forgetPullRequestHandled'
> {
  const write = (next: ReturnType<typeof normalizeWorkspaceStatusRuleConfig>): void => {
    window.api.ui.set({ workspaceStatusRules: next }).catch(console.error)
    set({ workspaceStatusRules: next })
  }
  return {
    workspaceStatusRules: cloneDefaultWorkspaceStatusRuleConfig(),
    setWorkspaceStatusRules: (rules) => {
      write(normalizeWorkspaceStatusRuleConfig(rules))
    },
    markPullRequestHandled: (keys) => {
      const current = get().workspaceStatusRules
      const missing = keys.filter((key) => !current.handledPullRequests.includes(key))
      if (missing.length === 0) {
        return
      }
      write(
        normalizeWorkspaceStatusRuleConfig({
          ...current,
          handledPullRequests: [...current.handledPullRequests, ...missing]
        })
      )
    },
    forgetPullRequestHandled: (keys) => {
      const current = get().workspaceStatusRules
      // Why by pull request: forgetting it must also drop the entries keyed on a reviewed commit.
      const remaining = current.handledPullRequests.filter(
        (entry) => !keys.some((key) => isHandledKeyForPullRequest(entry, key))
      )
      if (remaining.length === current.handledPullRequests.length) {
        return
      }
      write(normalizeWorkspaceStatusRuleConfig({ ...current, handledPullRequests: remaining }))
    }
  }
}
