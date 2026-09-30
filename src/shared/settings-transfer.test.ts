import { describe, expect, it } from 'vitest'
import {
  buildSettingsTransferBundle,
  mergeImportedSettings,
  mergeImportedStatusRules,
  parseSettingsTransfer
} from './settings-transfer'
import { cloneDefaultWorkspaceStatusRuleConfig } from './workspace-status-rule-config'

const settings = {
  theme: 'dark',
  terminalFontSize: 13,
  editorWordWrap: true,
  diffDefaultView: 'split',
  claudeManagedAccounts: [{ id: 'a' }],
  opencodeSessionCookie: 'cookie',
  opencodeGoApiKey: 'key',
  androidSdkPath: '/Users/me/sdk',
  machineName: 'my-mac',
  httpProxyUrl: 'http://proxy',
  agentDefaultEnv: { OPENAI_API_KEY: 'sk' },
  nativeChatShellEnvironmentVariables: { TOKEN: 'x' },
  floatingTerminalTrustedCwds: ['/Users/me'],
  terminalDefaultShell: '/bin/zsh',
  telemetry: { optedIn: true },
  githubProjects: [{ id: 1 }],
  terminalMacOptionAsAltMigrated: true,
  workspaceDir: '/Users/me/orca/workspaces',
  voice: { enabled: true, modelsDir: '/Users/me/models', microphoneDeviceId: 'mic-1' },
  notifications: { enabled: true, customSoundPath: '/Users/me/ping.wav' },
  terminalQuickCommands: [
    { id: 'a', label: 'Test', scope: { type: 'global' }, command: 'pnpm test' },
    { id: 'b', label: 'Deploy', scope: { type: 'repo', repoId: 'repo-1' }, command: 'deploy' }
  ]
}

const ui = {
  sidebarWidth: 280,
  windowBounds: { x: 1 },
  trustedOrcaHooks: { repo: true },
  featureTipsSeenIds: ['a'],
  groupBy: 'workspace-status',
  workspaceStatuses: [{ id: 'review', label: 'Review' }],
  worktreeCardProperties: ['linear-title'],
  workspaceStatusRules: {
    enabled: true,
    repoIds: ['repo-1'],
    handledPullRequests: ['acme/app#1'],
    ledgerVersion: 3,
    newWorkspaceStatusSince: 123,
    statusByCondition: { reviewing: 'review' },
    actionPrompts: { reviewPullRequest: 'Review it' }
  }
}

const files = { keybindings: '{"tab.runQuickCommand":["Mod+R"]}', editorThemes: {} }

describe('settings transfer', () => {
  it('exports preferences and leaves out credentials, paths, this machine and bookkeeping', () => {
    const bundle = buildSettingsTransferBundle({ settings, ui, files, now: new Date(0) })

    expect(Object.keys(bundle.settings).sort()).toEqual([
      'diffDefaultView',
      'editorWordWrap',
      'notifications',
      'terminalFontSize',
      'terminalQuickCommands',
      'theme',
      'voice'
    ])
    expect(bundle.settings.voice).toEqual({ enabled: true })
    expect(bundle.settings.notifications).toEqual({ enabled: true })
    expect(bundle.settings.terminalQuickCommands).toEqual([
      { id: 'a', label: 'Test', scope: { type: 'global' }, command: 'pnpm test' }
    ])
    expect(Object.keys(bundle.ui).sort()).toEqual([
      'groupBy',
      'workspaceStatusRules',
      'workspaceStatuses',
      'worktreeCardProperties'
    ])
    expect(bundle.ui.workspaceStatusRules).toEqual({
      enabled: true,
      statusByCondition: { reviewing: 'review' },
      actionPrompts: { reviewPullRequest: 'Review it' }
    })
    expect(bundle.keybindings).toBe(files.keybindings)
  })

  it('filters an edited file again on the way in', () => {
    const edited = JSON.stringify({
      format: 'orca-settings',
      version: 1,
      settings: { theme: 'light', opencodeGoApiKey: 'planted' },
      ui: { groupBy: 'repo', windowBounds: { x: 9 }, workspaceStatusRules: { repoIds: ['x'] } },
      keybindings: null,
      editorThemes: { 'editor-dark.json': '{}', '../../etc/passwd': 'x' }
    })

    const parsed = parseSettingsTransfer(edited)

    expect(parsed).toMatchObject({ ok: true })
    if (parsed.ok) {
      expect(parsed.bundle.settings).toEqual({ theme: 'light' })
      expect(parsed.bundle.ui).toEqual({ groupBy: 'repo', workspaceStatusRules: {} })
      expect(parsed.bundle.editorThemes).toEqual({ 'editor-dark.json': '{}' })
    }
  })

  it('refuses a file that is not an Orca export, or from a newer format', () => {
    expect(parseSettingsTransfer('nope')).toMatchObject({ ok: false })
    expect(parseSettingsTransfer('{"format":"other"}')).toMatchObject({ ok: false })
    expect(parseSettingsTransfer('{"format":"orca-settings","version":2}')).toMatchObject({
      ok: false
    })
  })

  it('keeps the importing machine’s projects and ledger when merging automations', () => {
    const current = {
      ...cloneDefaultWorkspaceStatusRuleConfig(),
      repoIds: ['mine'],
      handledPullRequests: ['acme/app#9'],
      newWorkspaceStatusSince: 5
    }

    const merged = mergeImportedStatusRules(
      current,
      { enabled: true, newWorkspaceStatus: 'in-progress', statusByCondition: { draft: 'draft' } },
      1_000
    )

    expect(merged).toMatchObject({
      enabled: true,
      repoIds: ['mine'],
      handledPullRequests: ['acme/app#9'],
      statusByCondition: { draft: 'draft' },
      newWorkspaceStatusSince: 1_000
    })
  })

  it('merges nested settings so the importer keeps their own private fields', () => {
    expect(
      mergeImportedSettings(
        { voice: { enabled: false, modelsDir: '/theirs' }, theme: 'light', untouched: 1 },
        { voice: { enabled: true }, theme: 'dark' }
      )
    ).toEqual({ voice: { enabled: true, modelsDir: '/theirs' }, theme: 'dark' })
  })
})
