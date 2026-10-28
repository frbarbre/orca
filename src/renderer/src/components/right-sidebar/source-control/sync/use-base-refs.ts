import type { HostedReviewInfo } from '../../../../../../shared/hosted-review'
import type { SourceControlWorktreeContext } from '../listing/use-worktree-context'
import {
  resolveSourceControlBaseRef,
  resolveSourceControlCompareBaseRef,
  resolveSourceControlPickerBaseRef
} from '../../../../../../shared/source-control-base-ref-resolution'
import { useSourceControlBaseRefDefault } from './use-base-ref-default'
import { useIsReviewedCommit } from '@/lib/reviewed-commit-bases'

export function useSourceControlBaseRefs({
  activeRepoConnectionId,
  activeRepoExecutionHostId,
  activeRepoId,
  activeRepoWorktreeBaseRef,
  activeWorktreeBaseRef,
  hostedReview,
  isBranchVisible,
  isFolder,
  remoteStatus,
  settings
}: {
  activeRepoConnectionId: SourceControlWorktreeContext['activeRepoConnectionId']
  activeRepoExecutionHostId: SourceControlWorktreeContext['activeRepoExecutionHostId']
  activeRepoId: string | null
  activeRepoWorktreeBaseRef: string | undefined
  activeWorktreeBaseRef: string | undefined
  hostedReview: HostedReviewInfo | null
  isBranchVisible: boolean
  isFolder: boolean
  remoteStatus: SourceControlWorktreeContext['remoteStatus']
  settings: SourceControlWorktreeContext['settings']
}) {
  const defaultBaseRef = useSourceControlBaseRefDefault({
    activeRepoConnectionId,
    activeRepoExecutionHostId,
    activeRepoId,
    isBranchVisible,
    isFolder
  })

  const normalizedWorktreeBaseRef = activeWorktreeBaseRef?.trim() || null
  const normalizedRepoBaseRef = activeRepoWorktreeBaseRef?.trim() || null
  const baseRefOwnedByWorktree = normalizedWorktreeBaseRef !== null
  const pinnedBaseRef = normalizedWorktreeBaseRef ?? normalizedRepoBaseRef

  const effectiveBaseRef = resolveSourceControlBaseRef({
    worktreeBaseRef: normalizedWorktreeBaseRef,
    reviewBaseRefName: hostedReview?.baseRefName,
    repoBaseRef: normalizedRepoBaseRef,
    defaultBaseRef
  })
  // Why: the compare/diff view uses this base; the PR/rebase merge target keeps effectiveBaseRef (equal when the setting is off).
  const pinnedToReviewedCommit = useIsReviewedCommit(normalizedWorktreeBaseRef)
  const resolvedCompareBaseRef = resolveSourceControlCompareBaseRef({
    enabled: settings?.sourceControlCompareAgainstUpstream ?? false,
    worktreeBaseRef: normalizedWorktreeBaseRef,
    repoBaseRef: normalizedRepoBaseRef,
    upstreamName: remoteStatus?.upstreamName ?? null,
    fallbackBaseRef: effectiveBaseRef
  })
  const compareBaseRef = pinnedToReviewedCommit ? normalizedWorktreeBaseRef : resolvedCompareBaseRef
  const pickerBaseRef = resolveSourceControlPickerBaseRef({
    pinnedBaseRef,
    effectiveBaseRef
  })

  return {
    baseRefOwnedByWorktree,
    compareBaseRef,
    defaultBaseRef,
    effectiveBaseRef,
    normalizedRepoBaseRef,
    normalizedWorktreeBaseRef,
    pickerBaseRef,
    pinnedBaseRef
  }
}

export type SourceControlBaseRefs = ReturnType<typeof useSourceControlBaseRefs>
