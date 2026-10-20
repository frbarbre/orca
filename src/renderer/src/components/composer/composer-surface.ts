import { createContext } from 'react'
import type { MentionOption } from '@/components/pull-request-page/page-types'

/** What a surface's boxes share, such as the pull request a page shows. */
export type ComposerSurface = {
  /** The workspace attached to what the surface shows; null when none is. */
  worktreeId: string | null
  /** Who `@` suggests, such as the item's author and commenters. */
  people?: readonly MentionOption[]
}

/** Left unset, a box belongs to the active workspace. */
export const ComposerSurfaceContext = createContext<ComposerSurface | undefined>(undefined)
