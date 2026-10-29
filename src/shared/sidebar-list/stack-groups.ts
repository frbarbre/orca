import type { Worktree } from '../worktree/types'
import type { OrderedGroupEntry, WorktreeGroupEntry } from './worktree-group-entry'

export type SidebarStackPlace = { number: number; position: number }

/** 'reviewing' is someone else's pull request, which gets its own lane whether or not it is stacked. */
export type SidebarStackReader = (worktree: Worktree) => SidebarStackPlace | 'reviewing' | null

const STACK_GROUP_PREFIX = 'stack:'

export const NO_STACK_GROUP_KEY = `${STACK_GROUP_PREFIX}none`

export const REVIEWING_STACK_GROUP_KEY = `${STACK_GROUP_PREFIX}reviewing`

export function getStackLaneKey(worktree: Worktree, stackOf: SidebarStackReader | undefined) {
  const stack = stackOf?.(worktree)
  if (stack === 'reviewing') {
    return REVIEWING_STACK_GROUP_KEY
  }
  return stack ? `${STACK_GROUP_PREFIX}${worktree.repoId}:${stack.number}` : NO_STACK_GROUP_KEY
}

export function getStackFromLaneKey(key: string): number | 'reviewing' | null {
  if (key === REVIEWING_STACK_GROUP_KEY) {
    return 'reviewing'
  }
  const number = Number(key.slice(key.lastIndexOf(':') + 1))
  return Number.isInteger(number) && number > 0 ? number : null
}

/** Reviewing first; then newest stack first, each listed from the PR furthest from main down; worktrees outside a stack last. */
export function orderStackGroups(
  grouped: Map<string, WorktreeGroupEntry>,
  stackOf: SidebarStackReader | undefined
): OrderedGroupEntry[] {
  const positionOf = (worktree: Worktree) => {
    const stack = stackOf?.(worktree)
    return stack && stack !== 'reviewing' ? stack.position : 0
  }
  const numberOf = (key: string) => {
    const stack = getStackFromLaneKey(key)
    return typeof stack === 'number' ? stack : 0
  }
  const stacks = [...grouped]
    .filter(([key]) => key !== NO_STACK_GROUP_KEY && key !== REVIEWING_STACK_GROUP_KEY)
    .sort(([left], [right]) => numberOf(right) - numberOf(left))
  for (const [, group] of stacks) {
    group.items.sort((left, right) => positionOf(right) - positionOf(left))
  }
  const lane = (key: string): OrderedGroupEntry[] => {
    const group = grouped.get(key)
    return group ? [[key, group]] : []
  }
  return [...lane(REVIEWING_STACK_GROUP_KEY), ...stacks, ...lane(NO_STACK_GROUP_KEY)]
}
