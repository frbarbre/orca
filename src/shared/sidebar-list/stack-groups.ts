import type { Worktree } from '../worktree/types'
import type { OrderedGroupEntry, WorktreeGroupEntry } from './worktree-group-entry'

export type SidebarStackPlace = { number: number; position: number }

export type SidebarStackReader = (worktree: Worktree) => SidebarStackPlace | null

const STACK_GROUP_PREFIX = 'stack:'

export const NO_STACK_GROUP_KEY = `${STACK_GROUP_PREFIX}none`

export function getStackLaneKey(worktree: Worktree, stackOf: SidebarStackReader | undefined) {
  const stack = stackOf?.(worktree)
  return stack ? `${STACK_GROUP_PREFIX}${worktree.repoId}:${stack.number}` : NO_STACK_GROUP_KEY
}

export function getStackNumberFromLaneKey(key: string): number | null {
  const number = Number(key.slice(key.lastIndexOf(':') + 1))
  return Number.isInteger(number) && number > 0 ? number : null
}

/** Newest stack first, each listed from the PR furthest from main down; worktrees outside a stack last. */
export function orderStackGroups(
  grouped: Map<string, WorktreeGroupEntry>,
  stackOf: SidebarStackReader | undefined
): OrderedGroupEntry[] {
  const positionOf = (worktree: Worktree) => stackOf?.(worktree)?.position ?? 0
  const stacks = [...grouped]
    .filter(([key]) => key !== NO_STACK_GROUP_KEY)
    .sort(
      ([left], [right]) =>
        (getStackNumberFromLaneKey(right) ?? 0) - (getStackNumberFromLaneKey(left) ?? 0)
    )
  for (const [, group] of stacks) {
    group.items.sort((left, right) => positionOf(right) - positionOf(left))
  }
  const loose = grouped.get(NO_STACK_GROUP_KEY)
  return loose ? [...stacks, [NO_STACK_GROUP_KEY, loose]] : stacks
}
