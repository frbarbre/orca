import { z } from 'zod'

const OptionalStatus = z.string().optional()

const StatusByCondition = z.object({
  merged: OptionalStatus,
  closed: OptionalStatus,
  reviewing: OptionalStatus,
  draft: OptionalStatus,
  'changes-requested': OptionalStatus,
  merging: OptionalStatus,
  'pm-approval': OptionalStatus,
  review: OptionalStatus
})

export const WorkspaceStatusRules = z.object({
  enabled: z.boolean(),
  repoIds: z.array(z.string()),
  statusByCondition: StatusByCondition,
  mergingCheckName: z.string(),
  pmApprovalTeam: z.string().nullable(),
  onResolved: z.enum(['delete', 'none']),
  reviewInbox: z.object({
    enabled: z.boolean(),
    agent: z.string(),
    promptTemplate: z.string(),
    seeded: z.boolean()
  }),
  handledPullRequests: z.array(z.string())
})
