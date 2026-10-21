// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HostedReviewCreationEligibility } from '../../../../../../shared/hosted-review'
import { useSourceControlActionModel } from './use-action-model'

const canCreate: HostedReviewCreationEligibility = {
  provider: 'github',
  review: null,
  canCreate: true,
  blockedReason: null,
  nextAction: null,
  reviewLookupOutcome: 'not_found'
}

function renderActionModel({
  suppressed,
  loading = false,
  prState = null,
  reviewMerge = null
}: {
  suppressed: boolean
  loading?: boolean
  prState?: 'open' | null
  reviewMerge?: Parameters<typeof useSourceControlActionModel>[0]['reviewMerge']
}) {
  return renderHook(() =>
    useSourceControlActionModel({
      grouped: { staged: [], unstaged: [], untracked: [] },
      commitMessage: '',
      unresolvedConflictCount: 0,
      isCommitting: false,
      isRemoteOperationActive: false,
      isAbortingOperation: false,
      remoteStatusForActions: {
        hasUpstream: true,
        upstreamName: 'origin/feature',
        ahead: 0,
        behind: 0
      },
      hostedReviewStateForActions: prState,
      reviewMerge,
      isHostedReviewStateLoading: false,
      inFlightRemoteOpKind: null,
      hostedReviewCreation: canCreate,
      branchSummary: null,
      branchName: 'feature',
      canUseHostedReviewPushTarget: false,
      isCreatePrIntentInFlight: false,
      remoteStatus: { hasUpstream: true, upstreamName: 'origin/feature', ahead: 0, behind: 0 },
      hostedReviewState: null,
      hostedReviewCreationForHeader: canCreate,
      isHostedReviewCreationLoading: loading,
      prGenerating: false,
      isCreatingPr: false,
      hostedReviewReviewLabel: 'pull request',
      hasSuppressedGitHubPRState: suppressed,
      conflictOperation: 'unknown',
      effectiveBaseRef: null
    })
  ).result.current
}

describe('useSourceControlActionModel review merge', () => {
  it("merges the branch's open PR from the primary once everything is committed and pushed", () => {
    const model = renderActionModel({
      suppressed: false,
      prState: 'open',
      reviewMerge: {
        kind: 'merge',
        label: 'Squash and merge',
        tooltip: 'Ready to merge',
        disabled: false,
        run: () => undefined
      }
    })

    expect(model.primaryAction).toMatchObject({
      kind: 'merge',
      label: 'Squash and merge',
      disabled: false
    })
  })
})

describe('useSourceControlActionModel suppression', () => {
  it('preserves normal no-PR Create PR behavior', () => {
    expect(renderActionModel({ suppressed: false }).visibleCreatePrHeaderAction?.label).toBe(
      'Create PR'
    )
  })

  it.each([false, true])(
    'removes Create PR from header, composer, and primary action while suppression is active (loading=%s)',
    (loading) => {
      const model = renderActionModel({ suppressed: true, loading })

      expect(model.createPrHeaderAction).toBeNull()
      expect(model.visibleCreatePrHeaderAction).toBeNull()
      expect(model.directCreatePrAction).toBeNull()
      expect(model.primaryAction.kind).not.toMatch(/^create_pr/)
    }
  )
})
