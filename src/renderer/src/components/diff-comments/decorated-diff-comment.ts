import type { DiffComment } from '../../../../shared/diff-comment-types'

export type DecoratedDiffComment = DiffComment & {
  author?: string
  authorAvatarUrl?: string
  createdAtLabel?: string
  url?: string
  canDelete?: boolean
  canEdit?: boolean
  /** Fork: agent notes that reply to this user note (`orca notes reply`). */
  agentReplies?: DiffComment[]
}
