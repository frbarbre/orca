import { isTuiAgent } from './tui-agent-config'
import type { TuiAgent } from './tui-agent'
import type { WorkspaceStatus } from './worktree/types'

/** Evaluation order. The first condition a pull request satisfies wins. */
export const WORKSPACE_STATUS_RULE_CONDITIONS = [
  'merged',
  'closed',
  'reviewing',
  'draft',
  'changes-requested',
  'merging',
  'pm-approval',
  'review'
] as const

export type WorkspaceStatusRuleCondition = (typeof WORKSPACE_STATUS_RULE_CONDITIONS)[number]

export type WorkspaceStatusRuleReviewInbox = {
  enabled: boolean
  agent: TuiAgent
  promptTemplate: string
}

export type WorkspaceStatusRuleConfig = {
  enabled: boolean
  /** Projects the rules act on. Empty means the rules do nothing. */
  repoIds: string[]
  statusByCondition: Partial<Record<WorkspaceStatusRuleCondition, WorkspaceStatus>>
  mergingCheckName: string
  /** `org/team-slug`, or null when PM approval is not in use. */
  pmApprovalTeam: string | null
  /** What to do once a pull request is merged or closed without merging. */
  onResolved: 'delete' | 'none'
  /** What to do once you have approved or requested changes on someone else's pull request. */
  onReviewed: 'delete' | 'none'
  reviewInbox: WorkspaceStatusRuleReviewInbox
  /** `owner/repo#number` keys already acted on, so a create never repeats. */
  handledPullRequests: string[]
  /** Bumped when the meaning of `handledPullRequests` changes; an older ledger is discarded. */
  ledgerVersion?: number
}

export const DEFAULT_MERGING_CHECK_NAME = 'Reviews satisfied'

export const DEFAULT_REVIEW_PROMPT_TEMPLATE = `You are reviewing pull request #{{prNumber}} — "{{title}}" by {{author}} ({{url}}).
The branch {{branch}} is checked out and the diff is pointed at {{baseRef}}.

What UI changes should I check for?

Analyse the changes, and point out the most important bits of the PR and what could be
potential weak points. Analyse the architecture decisions; are they aligned with the codebase?`

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : null
}

/** 1 drops ledgers written by the removed seeding step, which recorded reviews
 *  as handled without ever cloning them. Re-cloning something that does have a
 *  workspace is already prevented by the linked-PR and branch checks. */
const SEED_LEDGER_VERSION = 1

const MAX_HANDLED_PULL_REQUESTS = 500
const MAX_CHECK_NAME_LENGTH = 120
const MAX_TEAM_LENGTH = 120

export function cloneDefaultWorkspaceStatusRuleConfig(): WorkspaceStatusRuleConfig {
  return {
    enabled: false,
    repoIds: [],
    statusByCondition: {},
    mergingCheckName: DEFAULT_MERGING_CHECK_NAME,
    pmApprovalTeam: null,
    onResolved: 'none',
    onReviewed: 'none',
    reviewInbox: {
      enabled: false,
      agent: 'claude',
      promptTemplate: DEFAULT_REVIEW_PROMPT_TEMPLATE
    },
    handledPullRequests: [],
    ledgerVersion: SEED_LEDGER_VERSION
  }
}

export function makeHandledPullRequestKey(
  repo: { owner: string; repo: string },
  number: number
): string {
  return `${repo.owner}/${repo.repo}#${number}`
}

function sanitizeString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') {
    return fallback
  }
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function sanitizeStatusByCondition(
  value: unknown
): Partial<Record<WorkspaceStatusRuleCondition, WorkspaceStatus>> {
  const raw = asRecord(value)
  if (!raw) {
    return {}
  }
  const mapped: Partial<Record<WorkspaceStatusRuleCondition, WorkspaceStatus>> = {}
  for (const condition of WORKSPACE_STATUS_RULE_CONDITIONS) {
    const status = raw[condition]
    if (typeof status === 'string' && status.trim()) {
      mapped[condition] = status.trim()
    }
  }
  return mapped
}

function sanitizeReviewInbox(value: unknown): WorkspaceStatusRuleReviewInbox {
  const defaults = cloneDefaultWorkspaceStatusRuleConfig().reviewInbox
  const raw = asRecord(value)
  if (!raw) {
    return defaults
  }
  return {
    enabled: raw.enabled === true,
    agent: isTuiAgent(raw.agent) ? raw.agent : defaults.agent,
    promptTemplate:
      typeof raw.promptTemplate === 'string' && raw.promptTemplate.trim()
        ? raw.promptTemplate
        : defaults.promptTemplate
  }
}

function sanitizeHandledPullRequests(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const keys = value.filter((entry): entry is string => typeof entry === 'string' && !!entry.trim())
  // Why: newest keys matter most, so an overlong ledger drops its oldest entries.
  return [...new Set(keys)].slice(-MAX_HANDLED_PULL_REQUESTS)
}

export function normalizeWorkspaceStatusRuleConfig(value: unknown): WorkspaceStatusRuleConfig {
  const defaults = cloneDefaultWorkspaceStatusRuleConfig()
  const raw = asRecord(value)
  if (!raw) {
    return defaults
  }
  const pmApprovalTeam =
    typeof raw.pmApprovalTeam === 'string' && raw.pmApprovalTeam.trim()
      ? raw.pmApprovalTeam.trim().slice(0, MAX_TEAM_LENGTH)
      : null
  return {
    enabled: raw.enabled === true,
    repoIds: Array.isArray(raw.repoIds)
      ? [
          ...new Set(
            raw.repoIds.filter((id): id is string => typeof id === 'string' && !!id.trim())
          )
        ]
      : [],
    statusByCondition: sanitizeStatusByCondition(raw.statusByCondition),
    mergingCheckName: sanitizeString(
      raw.mergingCheckName,
      defaults.mergingCheckName,
      MAX_CHECK_NAME_LENGTH
    ),
    pmApprovalTeam,
    onResolved: raw.onResolved === 'delete' ? 'delete' : 'none',
    onReviewed: raw.onReviewed === 'delete' ? 'delete' : 'none',
    reviewInbox: sanitizeReviewInbox(raw.reviewInbox),
    handledPullRequests:
      raw.ledgerVersion === SEED_LEDGER_VERSION
        ? sanitizeHandledPullRequests(raw.handledPullRequests)
        : [],
    ledgerVersion: SEED_LEDGER_VERSION
  }
}

export function parsePmApprovalTeam(value: string | null): { org: string; slug: string } | null {
  if (!value) {
    return null
  }
  const [org, slug] = value.split('/')
  return org?.trim() && slug?.trim() ? { org: org.trim(), slug: slug.trim() } : null
}
