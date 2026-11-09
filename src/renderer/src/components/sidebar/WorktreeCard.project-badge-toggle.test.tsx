import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { Repo } from '../../../../shared/repo-types'
import type { WorktreeCardProperty } from '../../../../shared/ui-chrome-types'
import type { Worktree } from '../../../../shared/worktree/types'

let worktreeCardProperties: WorktreeCardProperty[] = []
let settings: Partial<GlobalSettings> | null = null
const WORKTREE_CARD_IMPORT_TIMEOUT_MS = 15_000
const PROJECT_CHIP = 'aria-label="Project orca"'

vi.mock('@/store', () => {
  const getState = () => ({
    deleteStateByWorktreeId: {},
    fetchHostedReviewForBranch: vi.fn(),
    fetchIssue: vi.fn(),
    fetchLinearIssue: vi.fn(),
    gitConflictOperationByWorktree: {},
    hostedReviewCache: {},
    issueCache: {},
    linearIssueCache: {},
    openModal: vi.fn(),
    projectGroups: [],
    remoteBranchConflictByWorktreeId: {},
    settings,
    sshConnectionStates: new Map(),
    sshTargetLabels: new Map(),
    updateWorktreeMeta: vi.fn(),
    workspacePortScan: null,
    worktreeCardProperties
  })
  return {
    useAppStore: Object.assign((selector: (state: unknown) => unknown) => selector(getState()), {
      getState,
      subscribe: () => () => {}
    })
  }
})

vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('./use-worktree-activity-status', () => ({
  useWorktreeActivityStatus: () => 'idle'
}))

vi.mock('./use-worktree-sleep-state', () => ({
  useIsSleepingWorktree: () => false
}))

vi.mock('./CacheTimer', () => ({
  default: () => null,
  usePromptCacheCountdownStartedAt: () => null
}))

vi.mock('./WorktreeCardAgents', () => ({
  default: () => null
}))

vi.mock('./WorktreeContextMenu', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
  WORKTREE_NATIVE_CONTEXT_MENU_ATTR: 'data-worktree-native-context-menu',
  WORKTREE_CONTEXT_MENU_SCOPE_ATTR: 'data-orca-context-menu-scope'
}))

const repo: Repo = {
  id: 'repo-1',
  path: '/repo',
  displayName: 'orca',
  badgeColor: '#999999',
  addedAt: 1
}

const worktree: Worktree = {
  id: 'repo-1::/repo/worktrees/project',
  repoId: 'repo-1',
  path: '/repo/worktrees/project',
  displayName: 'Project tree',
  branch: 'feature/project',
  head: 'abc123',
  isBare: false,
  isMainWorktree: false,
  comment: '',
  linkedIssue: null,
  linkedPR: null,
  linkedLinearIssue: null,
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 0,
  lastActivityAt: 1
}

async function renderCardMarkup(): Promise<string> {
  const { default: WorktreeCard } = await import('./WorktreeCard')
  return renderToStaticMarkup(<WorktreeCard worktree={worktree} repo={repo} isActive={false} />)
}

describe('WorktreeCard project chip toggle', () => {
  beforeEach(() => {
    settings = { compactWorktreeCards: false, experimentalNewWorktreeCardStyle: true }
  })

  // The first WorktreeCard import transforms its whole module graph.
  it(
    'shows the project chip while the Project card property is on',
    async () => {
      worktreeCardProperties = ['status', 'project']
      expect(await renderCardMarkup()).toContain(PROJECT_CHIP)
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  // The first WorktreeCard import transforms its whole module graph.
  it(
    'hides the project chip once the Project card property is off',
    async () => {
      worktreeCardProperties = ['status']
      expect(await renderCardMarkup()).not.toContain(PROJECT_CHIP)
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )

  // The first WorktreeCard import transforms its whole module graph.
  it(
    'leaves compact cards, which have no Card display menu, as they were',
    async () => {
      settings = { compactWorktreeCards: true, experimentalNewWorktreeCardStyle: false }
      worktreeCardProperties = ['status']
      expect(await renderCardMarkup()).toContain(PROJECT_CHIP)
    },
    WORKTREE_CARD_IMPORT_TIMEOUT_MS
  )
})
